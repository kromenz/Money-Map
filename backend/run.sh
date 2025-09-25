#!/bin/bash

npm install;
npx prisma generate;
npx prisma db push;
npx prisma db seed;

npm run start;

