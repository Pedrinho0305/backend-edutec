import express from "express";
import cors from "cors";
import mysql2 from "mysql2";

// --- Configuração do Ambiente e Aplicação ---

// Variáveis de ambiente devem ser configuradas (ex: via um arquivo .env)
const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

const app = express();
const port = 3333;

// Middleware
app.use(cors()); // Permite requisições de diferentes origens (necessário para o frontend)
app.use(express.json()); // Processa o corpo das requisições como JSON

// --- Inicialização do Banco de Dados ---

// Cria o pool de conexões com o MySQL
const database = mysql2.createPool({
    host: DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    connectionLimit: 10
});

// --- Definição das Rotas da API ---

/**
 * Rota GET /
 * Objetivo: Listar todos os usuários (apenas nome e email).
 */
app.get("/", (request, response) => {
    // Seleciona apenas o nome e email (boa prática de segurança)
    const selectCommand = "SELECT name, email FROM pedrohenrique_02mb";

    database.query(selectCommand, (error, users) => {
        if (error) {
            console.error("Erro na consulta GET /:", error);
            return response.status(500).json({ message: "Erro ao buscar usuários no banco de dados." }); 
        }

        // Retorna a lista de usuários em formato JSON
        response.json(users);
    });
});

/**
 * Rota POST /login
 * Objetivo: Autenticar um usuário com email e senha.
 * Espera no body: { "user": { "email": "...", "password": "..." } }
 */
app.post("/login", (request, response) => {
    // Obtém email e password do objeto 'user' no corpo da requisição
    const { email, password } = request.body.user;
    
    // Busca o usuário pelo email
    const selectCommand = "SELECT id, name, password FROM pedrohenrique_02mb WHERE email = ?";

    database.query(selectCommand, [email], (error, user) => {
        if (error) {
            console.error("Erro na consulta POST /login:", error);
            return response.status(500).json({ message: "Erro interno do servidor." });
        }

        // 1. Verifica se o usuário existe (length === 0)
        // 2. Verifica se a senha está incorreta
        if (user.length === 0 || user[0].password !== password) {
            // Status 401: Não Autorizado
            return response.status(401).json({ message: "Usuário ou senha incorretos!" });
        }

        // Login bem-sucedido
        // Retorna apenas dados não sensíveis
        response.json({ id: user[0].id, name: user[0].name });
    });
});

/**
 * Rota POST /cadastrar
 * Objetivo: Cadastrar um novo usuário no banco de dados.
 * Espera no body: { "user": { "name": "...", "email": "...", "password": "..." } }
 */
app.post("/cadastrar", (request, response) => {
    const { user } = request.body;
    console.log("Tentativa de cadastro:", user.email);

    // Comando SQL para inserção, usando placeholders (?) para segurança (prevenção de SQL Injection)
    const insertCommand = `
        INSERT INTO pedrohenrique_02mb(name, email, password)
        VALUES (?, ?, ?)
    `;

    database.query(insertCommand, [user.name, user.email, user.password], (error) => {
        if (error) {
            console.error("Erro na consulta POST /cadastrar:", error);
            // Status 409: Conflito (comum para emails já cadastrados - UNIQUE constraint)
            return response.status(409).json({ message: "Erro ao cadastrar usuário. O email pode já estar em uso." });
        }

        // Status 201: Criado
        response.status(201).json({ message: "Usuário cadastrado com sucesso!" });
    });
});

// --- Inicialização do Servidor ---

app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
});

/**
 * Rota POST /update-score
 * Objetivo: Atualizar o score máximo de um usuário no banco de dados.
 * Espera no body: { "email": "...", "newScore": 123 }
 */
app.post('/update-score', (request, response) => {
    const { email, newScore } = request.body;

    if (!email || typeof newScore !== 'number') {
        return response.status(400).json({ message: 'Dados inválidos. Email e newScore são obrigatórios.' });
    }

    // 1. Comando SQL para buscar o score atual
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
        
        // 2. Lógica: Só atualiza se o novo score for MAIOR que o atual (High Score)
        if (newScore > currentScore) {
            const updateCommand = 'UPDATE pedrohenrique_02mb SET score = ? WHERE email = ?';
            
            database.query(updateCommand, [newScore, email], (updateError) => {
                if (updateError) {
                    console.error('Erro ao atualizar score:', updateError);
                    return response.status(500).json({ message: 'Erro interno ao salvar novo score.' });
                }
                
                // Sucesso: Score atualizado
                return response.status(200).json({ 
                    message: 'Novo recorde salvo!', 
                    newHighScore: newScore 
                });
            });
        } else {
            // Score não é um novo recorde
            return response.status(200).json({ 
                message: 'Pontuação enviada, mas não é um novo recorde.', 
                currentScore: currentScore 
            });
        }
    });
});