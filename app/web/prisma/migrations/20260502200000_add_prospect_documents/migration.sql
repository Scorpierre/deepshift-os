CREATE TABLE "ProspectDocument" (
  "id"         TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "prospectId" TEXT NOT NULL,
  "filename"   TEXT NOT NULL,
  "mimeType"   TEXT NOT NULL,
  "data"       TEXT NOT NULL,
  CONSTRAINT "ProspectDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProspectDocument_prospectId_idx" ON "ProspectDocument"("prospectId");

ALTER TABLE "ProspectDocument" ADD CONSTRAINT "ProspectDocument_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
