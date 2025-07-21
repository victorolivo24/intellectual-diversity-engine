#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

python download_nltk_data.py

flask --app app db upgrade