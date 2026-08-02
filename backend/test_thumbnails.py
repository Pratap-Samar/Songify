import requests
from ytmusicapi import YTMusic

yt = YTMusic()
res = yt.search('song', filter='songs', limit=50)
for r in res:
    try:
        url = r['thumbnails'][-1]['url']
        resp = requests.head(url)
        if resp.status_code != 200:
            print(f"FAIL {r['videoId']}: {url} -> {resp.status_code}")
    except Exception as e:
        print(f"Error {r.get('videoId')}: {e}")
