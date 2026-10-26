-- The manage_features feature is now called developer: it shows Settings → Developer, Features included.
UPDATE "users" SET "features" = array_replace("features", 'manage_features', 'developer');
