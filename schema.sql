-- Tabela de admins
CREATE TABLE admin_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de categorias
CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de opções
CREATE TABLE options (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
  text VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de votos
CREATE TABLE votes (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
  option_id BIGINT REFERENCES options(id) ON DELETE CASCADE,
  voter_ip VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_categories_dates ON categories(start_date, end_date);
CREATE INDEX idx_votes_category ON votes(category_id);
CREATE INDEX idx_votes_category_ip ON votes(category_id, voter_ip);
CREATE INDEX idx_options_category ON options(category_id);

-- RLS (Row Level Security) - opcional, você pode ajustar conforme necessário
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Políticas básicas
-- Qualquer um pode ler categorias e opções
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Options are viewable by everyone" ON options
  FOR SELECT USING (true);

-- Qualquer um pode inserir votos
CREATE POLICY "Anyone can insert votes" ON votes
  FOR INSERT WITH CHECK (true);

-- Qualquer um pode ler votos (para resultados)
CREATE POLICY "Votes are viewable by everyone" ON votes
  FOR SELECT USING (true);
