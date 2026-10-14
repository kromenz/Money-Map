-- CreateTable
CREATE TABLE "public"."InboxReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboxReceipt_sourceId_key" ON "public"."InboxReceipt"("sourceId");

-- CreateIndex
CREATE INDEX "InboxReceipt_userId_idx" ON "public"."InboxReceipt"("userId");

-- AddForeignKey
ALTER TABLE "public"."InboxReceipt" ADD CONSTRAINT "InboxReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
