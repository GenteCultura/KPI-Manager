-- Schema Version: 2026-04-03-01
-- Create Diretorias table
CREATE TABLE IF NOT EXISTS public.diretorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for diretorias and clean up old ones
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diretorias' AND column_name='managerId') THEN
        ALTER TABLE public.diretorias DROP COLUMN "managerId";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='diretorias' AND column_name='manager_id') THEN
        ALTER TABLE public.diretorias ADD COLUMN manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create Departamentos table
CREATE TABLE IF NOT EXISTS public.departamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    diretoria_id UUID REFERENCES public.diretorias(id) ON DELETE CASCADE,
    manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for departamentos and clean up old ones
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departamentos' AND column_name='diretoriaId') THEN
        ALTER TABLE public.departamentos DROP COLUMN "diretoriaId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departamentos' AND column_name='managerId') THEN
        ALTER TABLE public.departamentos DROP COLUMN "managerId";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departamentos' AND column_name='diretoria_id') THEN
        ALTER TABLE public.departamentos ADD COLUMN diretoria_id UUID REFERENCES public.diretorias(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departamentos' AND column_name='manager_id') THEN
        ALTER TABLE public.departamentos ADD COLUMN manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create Gerencias table
CREATE TABLE IF NOT EXISTS public.gerencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    department_id UUID REFERENCES public.departamentos(id) ON DELETE CASCADE,
    manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for gerencias and clean up old ones
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gerencias' AND column_name='departmentId') THEN
        ALTER TABLE public.gerencias DROP COLUMN "departmentId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gerencias' AND column_name='managerId') THEN
        ALTER TABLE public.gerencias DROP COLUMN "managerId";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gerencias' AND column_name='department_id') THEN
        ALTER TABLE public.gerencias ADD COLUMN department_id UUID REFERENCES public.departamentos(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gerencias' AND column_name='manager_id') THEN
        ALTER TABLE public.gerencias ADD COLUMN manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create Servicos table
CREATE TABLE IF NOT EXISTS public.servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    gerencia_id UUID REFERENCES public.gerencias(id) ON DELETE CASCADE,
    manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for servicos and clean up old ones
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicos' AND column_name='gerenciaId') THEN
        ALTER TABLE public.servicos DROP COLUMN "gerenciaId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicos' AND column_name='managerId') THEN
        ALTER TABLE public.servicos DROP COLUMN "managerId";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicos' AND column_name='gerencia_id') THEN
        ALTER TABLE public.servicos ADD COLUMN gerencia_id UUID REFERENCES public.gerencias(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='servicos' AND column_name='manager_id') THEN
        ALTER TABLE public.servicos ADD COLUMN manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create Areas table
CREATE TABLE IF NOT EXISTS public.areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Update Teams table (v3)
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    diretoria_id UUID REFERENCES public.diretorias(id) ON DELETE SET NULL,
    dept_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
    gerencia_id UUID REFERENCES public.gerencias(id) ON DELETE SET NULL,
    servico_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
    leader_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for teams and clean up old ones
DO $$ 
BEGIN
    -- Remove old camelCase columns if they exist to clear cache
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='diretoriaId') THEN
        ALTER TABLE public.teams DROP COLUMN "diretoriaId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='departmentId') THEN
        ALTER TABLE public.teams DROP COLUMN "departmentId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='deptId') THEN
        ALTER TABLE public.teams DROP COLUMN "deptId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='gerenciaId') THEN
        ALTER TABLE public.teams DROP COLUMN "gerenciaId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='servicoId') THEN
        ALTER TABLE public.teams DROP COLUMN "servicoId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='leaderId') THEN
        ALTER TABLE public.teams DROP COLUMN "leaderId";
    END IF;

    -- Add new snake_case columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='diretoria_id') THEN
        ALTER TABLE public.teams ADD COLUMN diretoria_id UUID REFERENCES public.diretorias(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='dept_id') THEN
        ALTER TABLE public.teams ADD COLUMN dept_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='gerencia_id') THEN
        ALTER TABLE public.teams ADD COLUMN gerencia_id UUID REFERENCES public.gerencias(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='servico_id') THEN
        ALTER TABLE public.teams ADD COLUMN servico_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='leader_id') THEN
        ALTER TABLE public.teams ADD COLUMN leader_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Fix Teams table columns and functions (v4)
DO $$ 
BEGIN
    -- Rename createdAt to created_at if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='createdAt') THEN
        ALTER TABLE public.teams RENAME COLUMN "createdAt" TO created_at;
    END IF;

    -- Ensure created_at exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='created_at') THEN
        ALTER TABLE public.teams ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

-- Update the fetch function to use the correct column name
CREATE OR REPLACE FUNCTION public.get_teams_v2()
RETURNS TABLE (
    id TEXT,
    name TEXT,
    diretoria_id TEXT,
    dept_id TEXT,
    gerencia_id TEXT,
    servico_id TEXT,
    leader_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY SELECT 
        t.id::TEXT, 
        t.name, 
        t.diretoria_id::TEXT, 
        t.dept_id::TEXT, 
        t.gerencia_id::TEXT, 
        t.servico_id::TEXT, 
        t.leader_id::TEXT, 
        t.created_at 
    FROM public.teams t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.upsert_team_v2(
    p_id TEXT,
    p_name TEXT,
    p_diretoria_id TEXT,
    p_dept_id TEXT,
    p_gerencia_id TEXT,
    p_servico_id TEXT,
    p_leader_id TEXT
) RETURNS public.teams AS $$
DECLARE
    v_team public.teams;
BEGIN
    INSERT INTO public.teams (id, name, diretoria_id, dept_id, gerencia_id, servico_id, leader_id)
    VALUES (p_id, p_name, p_diretoria_id, p_dept_id, p_gerencia_id, p_servico_id, p_leader_id)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        diretoria_id = EXCLUDED.diretoria_id,
        dept_id = EXCLUDED.dept_id,
        gerencia_id = EXCLUDED.gerencia_id,
        servico_id = EXCLUDED.servico_id,
        leader_id = EXCLUDED.leader_id
    RETURNING * INTO v_team;
    RETURN v_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Users table if not exists (using TEXT for ID to match existing state)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    diretoria_id UUID REFERENCES public.diretorias(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
    gerencia_id UUID REFERENCES public.gerencias(id) ON DELETE SET NULL,
    servico_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    department TEXT,
    role TEXT,
    access_level TEXT DEFAULT 'Visualizador',
    status TEXT DEFAULT 'Ativo',
    permissions JSONB DEFAULT '{"canCreateIndicators": false, "canEditResults": false, "canViewOtherDepartments": false, "allowedTeams": [], "allowedAreas": [], "onlyOwnIndicators": true}'::jsonb,
    hire_date TIMESTAMP WITH TIME ZONE,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for users and clean up old ones
DO $$ 
BEGIN
    -- Remove old camelCase columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='diretoriaId') THEN
        ALTER TABLE public.users DROP COLUMN "diretoriaId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='departmentId') THEN
        ALTER TABLE public.users DROP COLUMN "departmentId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='gerenciaId') THEN
        ALTER TABLE public.users DROP COLUMN "gerenciaId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='servicoId') THEN
        ALTER TABLE public.users DROP COLUMN "servicoId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='teamId') THEN
        ALTER TABLE public.users DROP COLUMN "teamId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='accessLevel') THEN
        ALTER TABLE public.users DROP COLUMN "accessLevel";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='hireDate') THEN
        ALTER TABLE public.users DROP COLUMN "hireDate";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='photoUrl') THEN
        ALTER TABLE public.users DROP COLUMN "photoUrl";
    END IF;

    -- Add new snake_case columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='diretoria_id') THEN
        ALTER TABLE public.users ADD COLUMN diretoria_id UUID REFERENCES public.diretorias(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='department_id') THEN
        ALTER TABLE public.users ADD COLUMN department_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='gerencia_id') THEN
        ALTER TABLE public.users ADD COLUMN gerencia_id UUID REFERENCES public.gerencias(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='servico_id') THEN
        ALTER TABLE public.users ADD COLUMN servico_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='team_id') THEN
        ALTER TABLE public.users ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='access_level') THEN
        ALTER TABLE public.users ADD COLUMN access_level TEXT DEFAULT 'Visualizador';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='hire_date') THEN
        ALTER TABLE public.users ADD COLUMN hire_date TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='photo_url') THEN
        ALTER TABLE public.users ADD COLUMN photo_url TEXT;
    END IF;
END $$;

-- Create KPIs table
CREATE TABLE IF NOT EXISTS public.kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    department TEXT,
    description TEXT,
    unit TEXT,
    polarity TEXT,
    frequency TEXT,
    owner_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    target NUMERIC,
    actual NUMERIC,
    status TEXT DEFAULT 'Ativo',
    kpi_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for kpis and clean up old ones
DO $$ 
BEGIN
    -- Remove old camelCase columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kpis' AND column_name='templateId') THEN
        ALTER TABLE public.kpis DROP COLUMN "templateId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kpis' AND column_name='ownerId') THEN
        ALTER TABLE public.kpis DROP COLUMN "ownerId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kpis' AND column_name='kpiStatus') THEN
        ALTER TABLE public.kpis DROP COLUMN "kpiStatus";
    END IF;

    -- Add new snake_case columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kpis' AND column_name='template_id') THEN
        ALTER TABLE public.kpis ADD COLUMN template_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kpis' AND column_name='owner_id') THEN
        ALTER TABLE public.kpis ADD COLUMN owner_id TEXT REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kpis' AND column_name='kpi_status') THEN
        ALTER TABLE public.kpis ADD COLUMN kpi_status TEXT;
    END IF;
END $$;

-- Create Consolidations table
CREATE TABLE IF NOT EXISTS public.consolidations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collaborator_name TEXT,
    collaborator_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT,
    total_target TEXT,
    indicators JSONB,
    diretoria_id UUID REFERENCES public.diretorias(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    month TEXT,
    vacation_start TIMESTAMP WITH TIME ZONE,
    vacation_end TIMESTAMP WITH TIME ZONE,
    is_on_vacation BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for consolidations and clean up old ones
DO $$ 
BEGIN
    -- Remove old camelCase columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='collaboratorName') THEN
        ALTER TABLE public.consolidations DROP COLUMN "collaboratorName";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='collaboratorId') THEN
        ALTER TABLE public.consolidations DROP COLUMN "collaboratorId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='totalTarget') THEN
        ALTER TABLE public.consolidations DROP COLUMN "totalTarget";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='diretoriaId') THEN
        ALTER TABLE public.consolidations DROP COLUMN "diretoriaId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='departmentId') THEN
        ALTER TABLE public.consolidations DROP COLUMN "departmentId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='teamId') THEN
        ALTER TABLE public.consolidations DROP COLUMN "teamId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='vacationStart') THEN
        ALTER TABLE public.consolidations DROP COLUMN "vacationStart";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='vacationEnd') THEN
        ALTER TABLE public.consolidations DROP COLUMN "vacationEnd";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='isOnVacation') THEN
        ALTER TABLE public.consolidations DROP COLUMN "isOnVacation";
    END IF;

    -- Add new snake_case columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='collaborator_name') THEN
        ALTER TABLE public.consolidations ADD COLUMN collaborator_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='collaborator_id') THEN
        ALTER TABLE public.consolidations ADD COLUMN collaborator_id TEXT REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='total_target') THEN
        ALTER TABLE public.consolidations ADD COLUMN total_target TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='diretoria_id') THEN
        ALTER TABLE public.consolidations ADD COLUMN diretoria_id UUID REFERENCES public.diretorias(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='department_id') THEN
        ALTER TABLE public.consolidations ADD COLUMN department_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='team_id') THEN
        ALTER TABLE public.consolidations ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='vacation_start') THEN
        ALTER TABLE public.consolidations ADD COLUMN vacation_start TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='vacation_end') THEN
        ALTER TABLE public.consolidations ADD COLUMN vacation_end TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consolidations' AND column_name='is_on_vacation') THEN
        ALTER TABLE public.consolidations ADD COLUMN is_on_vacation BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id TEXT,
    target_name TEXT,
    action TEXT,
    changed_by TEXT,
    changed_by_id TEXT,
    changes JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for audit_logs and clean up old ones
DO $$ 
BEGIN
    -- Remove old camelCase columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='targetId') THEN
        ALTER TABLE public.audit_logs DROP COLUMN "targetId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='targetName') THEN
        ALTER TABLE public.audit_logs DROP COLUMN "targetName";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='changedBy') THEN
        ALTER TABLE public.audit_logs DROP COLUMN "changedBy";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='changedById') THEN
        ALTER TABLE public.audit_logs DROP COLUMN "changedById";
    END IF;

    -- Add new snake_case columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='target_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN target_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='target_name') THEN
        ALTER TABLE public.audit_logs ADD COLUMN target_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='changed_by') THEN
        ALTER TABLE public.audit_logs ADD COLUMN changed_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='changed_by_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN changed_by_id TEXT;
    END IF;
END $$;

-- Create Inventory Indicators table
CREATE TABLE IF NOT EXISTS public.inventory_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    name TEXT,
    target_role TEXT,
    responsible_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    responsible_name TEXT,
    responsible_role TEXT,
    target TEXT,
    weight NUMERIC,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    status TEXT,
    polarity TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist for inventory_indicators and clean up old ones
DO $$ 
BEGIN
    -- Remove old camelCase columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='targetRole') THEN
        ALTER TABLE public.inventory_indicators DROP COLUMN "targetRole";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='responsibleId') THEN
        ALTER TABLE public.inventory_indicators DROP COLUMN "responsibleId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='responsibleName') THEN
        ALTER TABLE public.inventory_indicators DROP COLUMN "responsibleName";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='responsibleRole') THEN
        ALTER TABLE public.inventory_indicators DROP COLUMN "responsibleRole";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='startDate') THEN
        ALTER TABLE public.inventory_indicators DROP COLUMN "startDate";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='endDate') THEN
        ALTER TABLE public.inventory_indicators DROP COLUMN "endDate";
    END IF;

    -- Add new snake_case columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='target_role') THEN
        ALTER TABLE public.inventory_indicators ADD COLUMN target_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='responsible_id') THEN
        ALTER TABLE public.inventory_indicators ADD COLUMN responsible_id TEXT REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='responsible_name') THEN
        ALTER TABLE public.inventory_indicators ADD COLUMN responsible_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='responsible_role') THEN
        ALTER TABLE public.inventory_indicators ADD COLUMN responsible_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='start_date') THEN
        ALTER TABLE public.inventory_indicators ADD COLUMN start_date TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_indicators' AND column_name='end_date') THEN
        ALTER TABLE public.inventory_indicators ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE public.diretorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gerencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_indicators ENABLE ROW LEVEL SECURITY;

-- Create policies (Simplified for development - restrict in production)
DO $$ 
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Access" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Public Access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.diretorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gerencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for production)
CREATE POLICY "Enable read access for all users" ON public.diretorias FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.diretorias FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.diretorias FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.diretorias FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON public.departamentos FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.departamentos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.departamentos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.departamentos FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON public.gerencias FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.gerencias FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.gerencias FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.gerencias FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON public.servicos FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.servicos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.servicos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.servicos FOR DELETE USING (auth.role() = 'authenticated');
