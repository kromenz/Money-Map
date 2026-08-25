-- CreateEnum
CREATE TYPE "public"."BrokerSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "public"."CashFlowType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'FEE', 'TRANSFER', 'INTEREST_ON_FREE_CASH', 'LENDING_INTEREST');

-- CreateEnum
CREATE TYPE "public"."SyncKind" AS ENUM ('summary', 'positions', 'orders', 'dividends', 'transactions');

-- CreateTable
CREATE TABLE "public"."Holding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(18,8) NOT NULL,
    "averagePricePaid" DECIMAL(18,8) NOT NULL,
    "currentPrice" DECIMAL(18,8) NOT NULL,
    "currentValue" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "unrealizedPl" DECIMAL(12,2) NOT NULL,
    "fxImpact" DECIMAL(12,2) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cash" DECIMAL(12,2) NOT NULL,
    "invested" DECIMAL(12,2) NOT NULL,
    "marketValue" DECIMAL(12,2) NOT NULL,
    "totalValue" DECIMAL(12,2) NOT NULL,
    "realizedPl" DECIMAL(12,2) NOT NULL,
    "unrealizedPl" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BrokerOrder" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "filledAt" TIMESTAMP(3) NOT NULL,
    "ticker" TEXT NOT NULL,
    "side" "public"."BrokerSide" NOT NULL,
    "orderType" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(18,8) NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "netValue" DECIMAL(12,2) NOT NULL,
    "fxRate" DECIMAL(18,8),
    "taxes" JSONB,
    "initiatedFrom" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BrokerDividend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "ticker" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "grossAmountPerShare" DECIMAL(18,8) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT '',
    "amountInEuro" DECIMAL(12,2) NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerDividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BrokerCashFlow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "type" "public"."CashFlowType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerCashFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "public"."SyncKind" NOT NULL,
    "backfillDone" BOOLEAN NOT NULL DEFAULT false,
    "backfillCursor" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holding_userId_ticker_key" ON "public"."Holding"("userId", "ticker");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioSnapshot_userId_date_key" ON "public"."PortfolioSnapshot"("userId", "date");

-- CreateIndex
CREATE INDEX "BrokerOrder_userId_filledAt_idx" ON "public"."BrokerOrder"("userId", "filledAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerOrder_userId_externalId_key" ON "public"."BrokerOrder"("userId", "externalId");

-- CreateIndex
CREATE INDEX "BrokerDividend_userId_paidOn_idx" ON "public"."BrokerDividend"("userId", "paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerDividend_userId_externalId_key" ON "public"."BrokerDividend"("userId", "externalId");

-- CreateIndex
CREATE INDEX "BrokerCashFlow_userId_dateTime_idx" ON "public"."BrokerCashFlow"("userId", "dateTime");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerCashFlow_userId_externalId_key" ON "public"."BrokerCashFlow"("userId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_userId_kind_key" ON "public"."SyncState"("userId", "kind");

-- AddForeignKey
ALTER TABLE "public"."Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BrokerOrder" ADD CONSTRAINT "BrokerOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BrokerDividend" ADD CONSTRAINT "BrokerDividend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BrokerCashFlow" ADD CONSTRAINT "BrokerCashFlow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncState" ADD CONSTRAINT "SyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
