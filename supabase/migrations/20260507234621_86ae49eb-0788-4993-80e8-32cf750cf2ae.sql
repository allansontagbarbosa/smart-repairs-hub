ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, admin';
NOTIFY pgrst, 'reload config';