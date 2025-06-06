CREATE TABLE IF NOT EXISTS "Wine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"iWine" varchar(255),
	"barcode" varchar(255),
	"location" varchar(255),
	"bin" varchar(255),
	"size" varchar(255),
	"currency" varchar(50),
	"exchangeRate" varchar(50),
	"valuation" varchar(255),
	"price" varchar(255),
	"nativePrice" varchar(255),
	"nativePriceCurrency" varchar(50),
	"storeName" varchar(255),
	"purchaseDate" varchar(255),
	"bottleNote" text,
	"vintage" varchar(50),
	"wine" text,
	"locale" varchar(255),
	"country" varchar(255),
	"region" varchar(255),
	"subRegion" varchar(255),
	"appellation" varchar(255),
	"producer" varchar(255),
	"sortProducer" varchar(255),
	"type" varchar(255),
	"color" varchar(255),
	"category" varchar(255),
	"varietal" varchar(255),
	"masterVarietal" varchar(255),
	"designation" varchar(255),
	"vineyard" varchar(255),
	"ct" varchar(255),
	"cNotes" text,
	"beginConsume" varchar(50),
	"endConsume" varchar(50),
	"fetchedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Wine" ADD CONSTRAINT "Wine_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
