-- CreateTable
CREATE TABLE "public"."PendingExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "category_group" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingExpense_userId_year_idx" ON "public"."PendingExpense"("userId", "year");

-- AddForeignKey
ALTER TABLE "public"."PendingExpense" ADD CONSTRAINT "PendingExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
