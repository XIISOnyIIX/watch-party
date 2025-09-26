# SQL Schema Fix - Reserved Keyword Issue

## 🐛 Issue Found
The original SQL schema used `current_time` as a column name, which is a **reserved keyword** in PostgreSQL. This caused a syntax error:

```
syntax error at or near "current_time"
```

## ✅ Solution Applied
Renamed the column from `current_time` to `current_position` to avoid the reserved keyword collision.

## 📝 Changes Made

### 1. Updated SQL Schema (`supabase-schema.sql`)
```sql
-- BEFORE (caused error)
current_time REAL DEFAULT 0,

-- AFTER (fixed)
current_position REAL DEFAULT 0,
```

### 2. Updated TypeScript Types (`src/lib/supabase.ts`)
```typescript
// BEFORE
current_time: number

// AFTER
current_position: number
```

### 3. Updated Database Service (`src/lib/database.ts`)
All references to `current_time` were changed to `current_position`:

- Room creation: `current_position: 0`
- Video updates: `current_position: 0`
- Video state updates: `current_position: currentTime`
- Data formatting: `currentTime: roomData.current_position`

## 🚀 Migration Instructions

### If You Haven't Run the Schema Yet:
1. Use the updated `supabase-schema.sql` file
2. Run it in your Supabase SQL Editor
3. Everything should work correctly

### If You Already Ran the Original Schema:
Run this fix in your Supabase SQL Editor:

```sql
-- Rename the problematic column
ALTER TABLE rooms RENAME COLUMN current_time TO current_position;
```

## ✅ Verification
After applying the fix, your `rooms` table should have:
- `current_position REAL DEFAULT 0` (not `current_time`)
- All other columns unchanged

The application logic remains exactly the same - this is purely a database column name change to avoid PostgreSQL reserved keywords.

## 🎯 Why This Happened
PostgreSQL has built-in functions like `CURRENT_TIME` that return the current time. When we used `current_time` as a column name, it created a conflict with this reserved keyword, especially in contexts like `ALTER PUBLICATION` statements.

The fix ensures our schema uses only safe, non-reserved identifiers. ✅