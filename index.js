import express from "express";
import cors from "cors";
import mysql2 from "mysql2";

// --- Configuração do Ambiente e Aplicação ---

// Variáveis de ambiente devem ser configuradas (ex: via um arquivo .env)
const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

const app = express();
const port = 3333;

// Configuração do CORS Otimizada (crucial para Vercel)
const corsOptions = {
    origin: '*', // Permite qualquer domínio
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); 
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
 * Objetivo: Listar todos os usuários (incluindo o score para o ranking).
 */
app.get("/", (request, response) => {
    // CORREÇÃO 1: Adicionar 'score' à seleção
    const selectCommand = "SELECT name, email, score FROM pedrohenrique_02mb";

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
 * Objetivo: Autenticar um usuário e retornar seus dados, incluindo o score atual.
 */
app.post("/login", (request, response) => {
    // Obtém email e password do objeto 'user' no corpo da requisição
    const { email, password } = request.body.user;
    
    // CORREÇÃO 2: Adicionar 'score' à seleção de login
    const selectCommand = "SELECT id, name, password, score FROM pedrohenrique_02mb WHERE email = ?";

    database.query(selectCommand, [email], (error, user) => {
        if (error) {
            console.error("Erro na consulta POST /login:", error);
            return response.status(500).json({ message: "Erro interno do servidor." });
        }

        if (user.length === 0 || user[0].password !== password) {
            return response.status(401).json({ message: "Usuário ou senha incorretos!" });
        }

        // Login bem-sucedido
        // Retorna o score
        response.json({ 
            id: user[0].id, 
            name: user[0].name, 
            score: user[0].score // Retorna o score
        });
    });
});

/**
 * Rota POST /cadastrar
 * Objetivo: Cadastrar um novo usuário com score inicial de 0.
 */
app.post("/cadastrar", (request, response) => {
    const { user } = request.body;
    console.log("Tentativa de cadastro:", user.email);

    // CORREÇÃO 3: Incluir 'score' na inserção e definir o valor inicial como 0
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

// A ROTA /update-score PERMANECE A MESMA, POIS JÁ ESTAVA CORRETA
// server.js - ROTA /update-score CORRIGIDA PARA SUBSTITUIÇÃO DIRETA

app.post('/update-score', (request, response) => {
    const { email, newScore: scoreData } = request.body;
    
    // Garante que o score enviado é um número (CORREÇÃO DE TIPAGEM)
    const newScore = Number(scoreData); 

    if (!email || typeof newScore !== 'number' || isNaN(newScore)) {
        return response.status(400).json({ 
            message: 'Dados inválidos. Email e newScore devem ser um número válido.'
        });
    }

    const updateCommand = 'UPDATE pedrohenrique_02mb SET score = ? WHERE email = ?';
    
    database.query(updateCommand, [newScore, email], (updateError, result) => {
        if (updateError) {
            console.error('Erro ao atualizar score:', updateError);
            return response.status(500).json({ message: 'Erro interno ao salvar pontuação.' });
        }

        if (result && result.affectedRows === 0) {
            return response.status(404).json({ message: 'Usuário não encontrado para atualizar a pontuação.' });
        }
        
        return response.status(200).json({ 
            message: 'Pontuação final salva com sucesso!', 
            finalScore: newScore 
        });
    });
});