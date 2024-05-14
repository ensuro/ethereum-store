#!/bin/bash

set -e

VERSION=$1
shift

if [ -z $VERSION ]; then
    echo "Usage: $0 <version> [<target dir>]" >&2
    exit 13
fi

TARGET_DIR=$1
if [ -z $TARGET_DIR ]; then
    TARGET_DIR=./build/npm-package/
fi

rm -fr $TARGET_DIR 2>/dev/null

mkdir -p $TARGET_DIR

npm ci
npm run build:lib

cp -r lib/ $TARGET_DIR

sed "s/%%VERSION%%/$VERSION/" npm-package/package.json > "$TARGET_DIR/package.json"

echo "

Now you should run:
cd $TARGET_DIR
npm login  # If not done already
npm publish --access public
"
