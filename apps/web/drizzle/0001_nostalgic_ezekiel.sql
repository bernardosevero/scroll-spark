CREATE TABLE "buffer_grants" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sealed_access_token" text NOT NULL,
	"sealed_refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"refreshing_until" timestamp with time zone,
	"needs_reconnect" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buffer_grants" ADD CONSTRAINT "buffer_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;