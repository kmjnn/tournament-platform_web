-- Переименование captain_id -> registered_by (существующие БД)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teams'
      AND column_name = 'captain_id'
  ) THEN
    ALTER TABLE teams RENAME COLUMN captain_id TO registered_by;
  END IF;
END $$;

-- Удаление is_captain (существующие БД)
ALTER TABLE team_members DROP COLUMN IF EXISTS is_captain;
