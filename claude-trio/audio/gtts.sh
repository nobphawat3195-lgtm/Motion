#!/bin/sh
# Thai VO from Google's translate TTS voice: one mp3 per line of audio/vo_script.txt -> audio/vo/g<N>.mp3
set -e
cd "$(dirname "$0")"
n=0
while IFS= read -r line <&3; do
  [ -z "$line" ] && continue
  n=$((n+1))
  curl -s -m 30 -G "https://translate.googleapis.com/translate_tts" \
    --data-urlencode "ie=UTF-8" --data-urlencode "client=gtx" --data-urlencode "tl=th" \
    --data-urlencode "q=$line" -o "vo/g$n.mp3" </dev/null
done 3< vo_script.txt
echo "$n lines"
