CREATE TABLE "buffer_cache" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"body" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "buffer_cache_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "buffer_quota" (
	"window_seconds" integer PRIMARY KEY NOT NULL,
	"quota" integer NOT NULL,
	"remaining" integer NOT NULL,
	"resets_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_channel_ids" jsonb;--> statement-breakpoint
ALTER TABLE "buffer_cache" ADD CONSTRAINT "buffer_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;