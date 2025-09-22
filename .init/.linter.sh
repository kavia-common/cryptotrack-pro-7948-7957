#!/bin/bash
cd /home/kavia/workspace/code-generation/cryptotrack-pro-7948-7957/cryptocurrency_tracker_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

