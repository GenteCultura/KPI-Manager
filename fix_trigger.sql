-- Este script corrige a trigger de criação de usuário no Supabase.
-- Como a tabela 'profiles' foi renomeada/substituída pela tabela 'users',
-- a trigger antiga (que tentava inserir em 'profiles') está falhando.

-- 1. Remove a trigger e a função antigas (se existirem)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Cria a nova função que insere na tabela 'users'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  is_first_user boolean;
  assigned_access_level text;
  assigned_role text;
BEGIN
  -- Verifica se é o primeiro usuário do sistema
  SELECT NOT EXISTS (SELECT 1 FROM public.users) INTO is_first_user;

  -- Se for o primeiro usuário ou o email do admin, dá permissão total
  IF is_first_user OR new.email = 'admin@test.com' OR new.email = 'weslleymatheusferreira@gmail.com' THEN
    assigned_access_level := 'Admin';
    assigned_role := 'Administrador';
  ELSE
    assigned_access_level := 'Visualizador';
    assigned_role := 'Visualizador';
  END IF;

  INSERT INTO public.users (
    id, 
    name, 
    email, 
    photo_url,
    role,
    access_level,
    status
  )
  VALUES (
    new.id::text,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'Usuário Novo'),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    assigned_role,
    assigned_access_level,
    'Ativo'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cria a nova trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
