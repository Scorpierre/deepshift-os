-- Re-add FK constraints with ON DELETE CASCADE so deleting a Prospect
-- also removes its Quotes, Invoices and Projects (and their children via existing cascades)

ALTER TABLE "Quote" DROP CONSTRAINT IF EXISTS "Quote_prospectId_fkey";
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_prospectId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_prospectId_fkey";
ALTER TABLE "Project" ADD CONSTRAINT "Project_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
