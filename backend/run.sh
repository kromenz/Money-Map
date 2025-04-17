#!/bin/bash

npm install;

npx prisma generate;

npx prisma db push;

npm run start;

