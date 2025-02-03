#!/bin/sh

for i in $(seq 1 10) ; do
    curl -X POST http://localhost:3000/ --data-urlencode 'content={ "text" : "本気でしているのか？" }' &
done

wait
