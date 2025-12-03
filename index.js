import express from "express";
import cors from "cors";
import mysql2 from "mysql2";

// --- Configuração do Ambiente e Aplicação ---

const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

const app = express();
// Nota: A porta 3333 só é usada localmente; na Vercel, o ambiente cuida disso.
const port = 3333; 

// --- Configuração do CORS OTIMIZADA ---
// Adicionando opções explícitas para permitir todas as origens, métodos e headers.
// Isso é crucial para que o navegador não bloqueie o 'fetch' de fora do 'localhost'.
const corsOptions = {
    origin: '*', // Permite qualquer domínio (CRUCIAL para Vercel/Produção)
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); 
app.use(express.json()); 

// --- Inicialização do Banco de Dados ---
const database = mysql2.createPool({
    host: DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    connectionLimit: 10
});

// --- Definição das Rotas da API (Sem Alterações na Lógica) ---

/** Rota GET /: Lista de Usuários */
app.get("/", (request, response) => {
    const selectCommand = "SELECT name, email, score FROM pedrohenrique_02mb"; 

    database.query(selectCommand, (error, users) => {
        if (error) {
            console.error("Erro na consulta GET /:", error);
            return response.status(500).json({ message: "Erro ao buscar usuários." }); 
        }
        response.json(users);
    });
});

/** Rota POST /login: Autenticação */
app.post("/login", (request, response) => {
    const { email, password } = request.body.user;
    const selectCommand = "SELECT id, name, password, score FROM pedrohenrique_02mb WHERE email = ?";

    database.query(selectCommand, [email], (error, user) => {
        if (error) {
            console.error("Erro na consulta POST /login:", error);
            return response.status(500).json({ message: "Erro interno do servidor." });
        }
        if (user.length === 0 || user[0].password !== password) {
            return response.status(401).json({ message: "Usuário ou senha incorretos!" });
        }
        response.json({ id: user[0].id, name: user[0].name, score: user[0].score });
    });
});

/** Rota POST /cadastrar: Cadastro de Usuário */
app.post("/cadastrar", (request, response) => {
    const { user } = request.body;
    
    const insertCommand = `
        INSERT INTO pedrohenrique_02mb(name, email, password, score)
        VALUES (?, ?, ?, 0)
    `;

    database.query(insertCommand, [user.name, user.email, user.password], (error) => {
        if (error) {
            console.error("Erro na consulta POST /cadastrar:", error);
            return response.status(409).json({ message: "Erro ao cadastrar usuário. O email pode já estar em uso." });
        }
        response.status(201).json({ message: "Usuário cadastrado com sucesso!" });
    });
});

/**
 * Rota POST /update-score: Atualização de Pontuação (Novo Recorde)
 */
app.post('/update-score', (request, response) => {
    const { email, newScore } = request.body;

    if (!email || typeof newScore !== 'number') {
        return response.status(400).json({ message: 'Dados inválidos. Email e newScore são obrigatórios.' });
    }

    const selectCommand = 'SELECT score FROM pedrohenrique_02mb WHERE email = ?';

    database.query(selectCommand, [email], (error, results) => {
        if (error) {
            console.error('Erro ao buscar score atual:', error);
            return response.status(500).json({ message: 'Erro interno ao buscar dados.' });
        }
        
        if (results.length === 0) {
            return response.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const currentScore = results[0].score || 0;
        
        if (newScore > currentScore) {
            const updateCommand = 'UPDATE pedrohenrique_02mb SET score = ? WHERE email = ?';
            
            database.query(updateCommand, [newScore, email], (updateError) => {
                if (updateError) {
                    console.error('Erro ao atualizar score:', updateError);
                    return response.status(500).json({ message: 'Erro interno ao salvar novo recorde.' });
                }
                
                return response.status(200).json({ 
                    message: 'Novo recorde salvo com sucesso!', 
                    newHighScore: newScore 
                });
            });
        } else {
            return response.status(200).json({ 
                message: 'Pontuação enviada, mas não é um novo recorde.', 
                currentScore: currentScore 
            });
        }
    });
});


// --- Inicialização do Servidor ---
app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
});