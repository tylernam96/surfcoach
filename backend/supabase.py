import os
from supabase import create_client, Client
from functools import lru_cache

@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")  # service key for backend (bypasses RLS)
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)