-- CreateTable
CREATE TABLE "public"."SheetParcel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetParcel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SheetParcel_userId_year_month_idx" ON "public"."SheetParcel"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "SheetParcel_userId_note_idx" ON "public"."SheetParcel"("userId", "note");

-- CreateIndex
CREATE UNIQUE INDEX "SheetParcel_userId_categoryId_year_month_seq_key" ON "public"."SheetParcel"("userId", "categoryId", "year", "month", "seq");

-- AddForeignKey
ALTER TABLE "public"."SheetParcel" ADD CONSTRAINT "SheetParcel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SheetParcel" ADD CONSTRAINT "SheetParcel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
