import json

# Read existing data
with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Read new data from txt file
new_items = []
with open('/Users/realone/Downloads/Japanese_60Day_Day8_to_60_Import.txt', 'r', encoding='utf-8') as f:
    for line in f:
        parts = line.strip().split('\t')
        if len(parts) >= 5:
            new_items.append({
                'word': parts[0],
                'yomi': parts[1],
                'meaning': parts[2],
                'sentence': parts[3],
                's_meaning': parts[4]
            })

# Merge
data.extend(new_items)

# Save
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Added {len(new_items)} items. Total: {len(data)} items')
