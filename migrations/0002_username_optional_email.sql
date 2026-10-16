-- Keep the users table and its IDs intact: dropping it would cascade into rides.
-- The old NOT NULL/UNIQUE email column becomes an opaque internal account key.
ALTER TABLE users RENAME COLUMN email TO account_key;
ALTER TABLE users ADD COLUMN username TEXT COLLATE NOCASE
  CHECK(username IS NULL OR (
    length(username) BETWEEN 3 AND 32
    AND username = lower(username) COLLATE BINARY
    AND username NOT GLOB '*[^a-z0-9._-]*'
    AND substr(username,1,1) GLOB '[a-z0-9]'
  ));
ALTER TABLE users ADD COLUMN email TEXT COLLATE NOCASE;
UPDATE users SET email = account_key;
UPDATE users SET account_key = id;
CREATE UNIQUE INDEX users_username ON users(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX users_optional_email ON users(email) WHERE email IS NOT NULL;
-- Existing users retain their email and sign in with it until choosing a username.
