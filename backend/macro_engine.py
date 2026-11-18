"""
Nutritional Macros & Smart Substitution Engine
Handles:
1. Cumulative Macronutrient Totals (Calories, Protein, Carbs, Fats, Fiber)
2. Macro Distribution Ratios (Energy % from Protein, Carbs, Fats)
3. Multi-Factor Smart Substitution Ranking (Macro Cosine Similarity + Walking Distance Penalty)
4. Dynamic Route Recalibration when an item is marked Out-Of-Stock
"""

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class MacroProfile:
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    serving_size: str
    servings_per_container: float
    macro_category: str

    def to_vector(self) -> List[float]:
        """Normalized macronutrient ratio vector: [Protein, Carbs, Fat]."""
        total = max(1.0, self.protein_g + self.carbs_g + self.fat_g)
        return [self.protein_g / total, self.carbs_g / total, self.fat_g / total]


class MacroEngine:
    """Manages nutrition tracking and calculates macro-equivalent substitutions."""

    @staticmethod
    def calculate_running_totals(items: List[Dict]) -> Dict:
        """
        Aggregates total calories, grams of protein, carbs, fats, fiber, and dollar cost.
        """
        total_calories = 0
        total_protein = 0.0
        total_carbs = 0.0
        total_fat = 0.0
        total_fiber = 0.0
        total_cost = 0.0

        for item in items:
            macros = item.get("macros", {})
            servings = macros.get("servings_per_container", 1.0)
            # Full package total values
            total_calories += int(macros.get("calories", 0))
            total_protein += float(macros.get("protein_g", 0))
            total_carbs += float(macros.get("carbs_g", 0))
            total_fat += float(macros.get("fat_g", 0))
            total_fiber += float(macros.get("fiber_g", 0))
            total_cost += float(item.get("price", 0.0))

        # Caloric distribution percentage
        cals_from_protein = total_protein * 4.0
        cals_from_carbs = total_carbs * 4.0
        cals_from_fat = total_fat * 9.0
        cal_sum = max(1.0, cals_from_protein + cals_from_carbs + cals_from_fat)

        return {
            "total_items": len(items),
            "total_cost": round(total_cost, 2),
            "calories": total_calories,
            "protein_g": round(total_protein, 1),
            "carbs_g": round(total_carbs, 1),
            "fat_g": round(total_fat, 1),
            "fiber_g": round(total_fiber, 1),
            "macro_distribution": {
                "protein_pct": round((cals_from_protein / cal_sum) * 100, 1),
                "carbs_pct": round((cals_from_carbs / cal_sum) * 100, 1),
                "fat_pct": round((cals_from_fat / cal_sum) * 100, 1),
            },
        }

    @staticmethod
    def compute_macro_similarity(m1: MacroProfile, m2: MacroProfile) -> float:
        """
        Computes cosine similarity between two item macro vectors.
        Returns value between 0.0 (completely dissimilar) and 1.0 (identical macro ratio).
        """
        v1 = m1.to_vector()
        v2 = m2.to_vector()

        dot_product = sum(a * b for a, b in zip(v1, v2))
        norm1 = math.sqrt(sum(a * a for a in v1))
        norm2 = math.sqrt(sum(b * b for b in v2))

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return max(0.0, min(1.0, dot_product / (norm1 * norm2)))

    @classmethod
    def rank_substitutes(
        cls,
        target_item: Dict,
        catalog: List[Dict],
        current_user_x: int,
        current_user_y: int,
        cell_size_feet: float = 4.0,
    ) -> List[Dict]:
        """
        Ranks all in-stock store items as potential substitutes for an out-of-stock item
        using a dual-objective score:
        Score = 0.70 * MacroSimilarity + 0.30 * DistanceEfficiency
        """
        target_macros_dict = target_item.get("macros", {})
        target_profile = MacroProfile(
            calories=target_macros_dict.get("calories", 0),
            protein_g=target_macros_dict.get("protein_g", 0),
            carbs_g=target_macros_dict.get("carbs_g", 0),
            fat_g=target_macros_dict.get("fat_g", 0),
            fiber_g=target_macros_dict.get("fiber_g", 0),
            serving_size=target_macros_dict.get("serving_size", ""),
            servings_per_container=target_macros_dict.get("servings_per_container", 1.0),
            macro_category=target_macros_dict.get("macro_category", "general"),
        )

        ranked = []
        for candidate in catalog:
            if candidate["sku"] == target_item["sku"]:
                continue
            if not candidate.get("in_stock", True):
                continue

            cand_macros_dict = candidate.get("macros", {})
            cand_profile = MacroProfile(
                calories=cand_macros_dict.get("calories", 0),
                protein_g=cand_macros_dict.get("protein_g", 0),
                carbs_g=cand_macros_dict.get("carbs_g", 0),
                fat_g=cand_macros_dict.get("fat_g", 0),
                fiber_g=cand_macros_dict.get("fiber_g", 0),
                serving_size=cand_macros_dict.get("serving_size", ""),
                servings_per_container=cand_macros_dict.get("servings_per_container", 1.0),
                macro_category=cand_macros_dict.get("macro_category", "general"),
            )

            # Category filter: favor same general category (e.g. meat to meat, dairy to dairy)
            category_match = 1.0 if candidate.get("category") == target_item.get("category") else 0.4

            macro_sim = cls.compute_macro_similarity(target_profile, cand_profile)

            # Physical walking distance from current customer position
            cx = candidate["coordinates"]["x"]
            cy = candidate["coordinates"]["y"]
            dist_feet = (abs(current_user_x - cx) + abs(current_user_y - cy)) * cell_size_feet
            dist_factor = max(0.0, 1.0 - (dist_feet / 300.0))  # Decays over 300 feet

            combined_score = (0.55 * macro_sim) + (0.25 * category_match) + (0.20 * dist_factor)

            # Differences
            p_diff = cand_profile.protein_g - target_profile.protein_g
            c_diff = cand_profile.carbs_g - target_profile.carbs_g
            f_diff = cand_profile.fat_g - target_profile.fat_g
            cal_diff = cand_profile.calories - target_profile.calories

            ranked.append({
                "sku": candidate["sku"],
                "name": candidate["name"],
                "brand": candidate.get("brand", ""),
                "aisle": candidate["aisle"],
                "price": candidate["price"],
                "coordinates": candidate["coordinates"],
                "perishable_class": candidate["perishable_class"],
                "macros": cand_macros_dict,
                "macro_similarity_pct": round(macro_sim * 100, 1),
                "walking_distance_feet": round(dist_feet, 1),
                "overall_fit_score": round(combined_score, 3),
                "macro_diff": {
                    "calories": cal_diff,
                    "protein_g": round(p_diff, 1),
                    "carbs_g": round(c_diff, 1),
                    "fat_g": round(f_diff, 1),
                },
                "explanation": f"{round(macro_sim*100)}% macro match • {round(dist_feet)} ft from current location",
            })

        ranked.sort(key=lambda x: x["overall_fit_score"], reverse=True)
        return ranked[:3]
