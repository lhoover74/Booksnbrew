-- Migration: 001_add_spam_score
-- Adds spam_score column to the leads table to support spam filtering
-- and lead qualification (High / Normal / Spam).
--
-- Run against your Cloudflare D1 database:
--   wrangler d1 execute <DB_NAME> --file=migrations/001_add_spam_score.sql
--
-- Or via the Cloudflare dashboard: Workers & Pages → D1 → <your DB> → Console

ALTER TABLE leads ADD COLUMN spam_score TEXT NOT NULL DEFAULT 'Normal';

-- After adding the column, backfill spam_score for rows that were already
-- marked with status = 'Spam' (if any exist from manual triage).
UPDATE leads SET spam_score = 'Spam' WHERE status = 'Spam';
