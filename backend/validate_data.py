import json
import os

BASE_DIR = os.path.dirname(__file__)
STORE_PATH = os.path.join(BASE_DIR, "store_data.json")
RECIPES_PATH = os.path.join(BASE_DIR, "recipes.json")

with open(STORE_PATH, "r", encoding="utf-8") as sf:
    store = json.load(sf)

with open(RECIPES_PATH, "r", encoding="utf-8") as rf:
    recipes = json.load(rf)

store_items = {it["item_id"]: it for it in store["items"]}
print(f"Store has {len(store_items)} items.")

missing_refs = {}
for r in recipes:
    for req_id in r.get("required_item_ids", []):
        if req_id not in store_items:
            missing_refs.setdefault(r["recipe_id"], []).append(req_id)

if missing_refs:
    print("WARNING: Missing recipe item references:", missing_refs)
else:
    print(f"SUCCESS: All {len(recipes)} recipes map 1-to-1 to valid store items!")
