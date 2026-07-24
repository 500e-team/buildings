import csv, json, time, re, sys, subprocess, urllib.parse, io

SHEET_ID = '1Q2kfu2okYabIyErTQPij8qdCjCFS4Z3iEk9Mgo2umMk'
CSV_URL = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv'
OUT_PATH = 'coords.json'
UA = '500E-Buildings-Geocoder/1.0 (internal tool for 500E Realty; contact: ianwu0415123@gmail.com)'

# rough fallback centers per generic 区域/详细位置 (used only if geocoding totally fails)
AREA_FALLBACK = {
    'Manhattan Midtown': (40.7549, -73.9840),
    'Manhattan Downtown': (40.7075, -74.0021),
    'Columbia / UWS': (40.8025, -73.9666),
    'Brooklyn': (40.6782, -73.9442),
    'Long Island City': (40.7447, -73.9485),
    'Queens': (40.7282, -73.7949),
    'Jersey City (NJ)': (40.7178, -74.0431),
    'Harrison': (40.7440, -74.1565),
}

# NYC metro rough bbox (left,top,right,bottom = lon_min,lat_max,lon_max,lat_min) — keeps
# short/generic building names (e.g. "Beach", "The Lane") from matching same-named places
# in New Jersey/Texas/Nevada/Ohio/Tennessee elsewhere in the US
VIEWBOX = '-74.35,41.05,-73.55,40.45'
BBOX = (40.45, 41.05, -74.35, -73.55)  # lat_min, lat_max, lon_min, lon_max

def in_bbox(lat, lon):
    lat_min, lat_max, lon_min, lon_max = BBOX
    return lat_min <= lat <= lat_max and lon_min <= lon <= lon_max

def nominatim_search(query):
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({
        'q': query, 'format': 'json', 'limit': 1, 'countrycodes': 'us',
        'viewbox': VIEWBOX, 'bounded': 1
    })
    out = subprocess.run(
        ['curl', '-s', '-A', UA, url],
        capture_output=True, text=True, timeout=20
    )
    data = json.loads(out.stdout)
    if data:
        lat, lon = float(data[0]['lat']), float(data[0]['lon'])
        if not in_bbox(lat, lon):
            return None
        return lat, lon, data[0].get('display_name', '')
    return None

def clean_name(name):
    # strip trailing "(Developer)" parenthetical
    return re.sub(r'\s*\([^)]*\)\s*$', '', name).strip()

def main():
    out = subprocess.run(['curl', '-sL', CSV_URL], capture_output=True, text=True, timeout=30)
    rows = list(csv.reader(io.StringIO(out.stdout)))
    header = rows[0]
    data = [dict(zip(header, r)) for r in rows[1:]]

    # dedupe by name, keep first
    seen = {}
    for d in data:
        name = d['大楼名称']
        if name and name not in seen:
            seen[name] = d

    try:
        with open(OUT_PATH, encoding='utf-8') as f:
            results = json.load(f)
    except FileNotFoundError:
        results = {}

    total = len(seen)
    done = 0
    ok_precise = 0
    ok_fallback = 0
    failed = []

    for name, d in seen.items():
        done += 1
        # keep precise hits from a prior run; retry anything that only fell back to an
        # area-center guess, since a rerun might catch a building OSM has since added
        if name in results and results[name].get('source') == 'geocoded':
            continue
        loc = d.get('详细位置', '')
        cname = clean_name(name)
        queries = [
            f"{cname}, {loc}, New York" if 'NJ' not in loc else f"{cname}, {loc}",
            f"{cname}, {loc}",
        ]
        found = None
        for q in queries:
            try:
                found = nominatim_search(q)
            except Exception as e:
                found = None
            time.sleep(1.1)
            if found:
                break

        if found:
            lat, lon, display = found
            results[name] = {'lat': lat, 'lon': lon, 'source': 'geocoded', 'display': display}
            ok_precise += 1
        elif loc in AREA_FALLBACK:
            lat, lon = AREA_FALLBACK[loc]
            results[name] = {'lat': lat, 'lon': lon, 'source': 'area_fallback', 'display': loc}
            ok_fallback += 1
            failed.append(name)
        else:
            failed.append(name)

        if done % 10 == 0 or done == total:
            with open(OUT_PATH, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=0)
            print(f'[{done}/{total}] precise={ok_precise} fallback={ok_fallback}', flush=True)

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=0)

    print('DONE', 'total', total, 'precise', ok_precise, 'area_fallback', ok_fallback)
    print('needs manual check (fallback or failed):', len(failed))
    with open('needs_review.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(failed))

if __name__ == '__main__':
    main()
