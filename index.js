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

// CORREÇÃO CRÍTICA 1: Testar a conexão imediatamente para diagnosticar o 500
database.getConnection((err, connection) => {
    if (err) {
        // Isso é o que causa o 500. Logamos o erro de conexão exato.
        console.error('*** ❌ ERRO FATAL: FALHA NA CONEXÃO COM O BANCO DE DADOS ***');
        console.error('Verifique as variáveis de ambiente (DB_HOST, DB_USER, etc.) na Vercel.', err);
    } else {
        console.log('✅ Conexão com o banco de dados MySQL estabelecida com sucesso.');
        connection.release(); // Libera a conexão imediatamente
    }
});


// --- Definição das Rotas da API ---

/**
 * Rota GET /
 * Objetivo: Listar todos os usuários (incluindo o score para o ranking).
 */
app.get("/", (request, response) => {
    const selectCommand = "SELECT name, email, score FROM pedrohenrique_02mb";

    database.query(selectCommand, (error, users) => {
        if (error) {
            console.error("Erro na consulta GET /:", error);
            return response.status(500).json({ message: "Erro ao buscar usuários no banco de dados." }); 
        }

        response.json(users);
    });
});

/**
 * Rota POST /login
 * Objetivo: Autenticar um usuário e retornar seus dados, incluindo o score atual.
 */
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

        response.json({ 
            id: user[0].id, 
            name: user[0].name, 
            score: user[0].score
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

    const insertCommand = `
        INSERT INTO pedrohenrique_02mb(name, email, password, score)
        VALUES (?, ?, ?, 0) 
    `;

    database.query(insertCommand, [user.name, user.email, user.password], (error) => {
        if (error) {
            console.error("Erro na consulta POST /cadastrar:", error);
            // 409 Conflict é o ideal para emails duplicados
            return response.status(409).json({ message: "Erro ao cadastrar usuário. O email pode já estar em uso." });
        }

        response.status(201).json({ message: "Usuário cadastrado com sucesso!" });
    });
});

/**
 * Rota POST /update-score
 * Objetivo: Salvar a pontuação final do jogador, substituindo o valor anterior.
 */
app.post('/update-score', (request, response) => {
    const { email, newScore: scoreData } = request.body;
    
    // CORREÇÃO: Garante que o score enviado é um número (trata undefined/string)
    const newScore = Number(scoreData); 

    if (!email || typeof newScore !== 'number' || isNaN(newScore)) {
        console.error('Dados de score inválidos recebidos:', request.body);
        return response.status(400).json({ 
            message: 'Dados inválidos. Email e newScore devem ser um número válido.'
        });
    }

    // Com o objetivo de apenas substituir a pontuação (sem checagem de recorde)
    const updateCommand = 'UPDATE pedrohenrique_02mb SET score = ? WHERE email = ?';
    
    database.query(updateCommand, [newScore, email], (updateError, result) => {
        if (updateError) {
            console.error('Erro ao executar UPDATE score:', updateError);
            return response.status(500).json({ message: 'Erro interno ao salvar pontuação.' });
        }

        // Verifica se a atualização foi bem sucedida (se o usuário existia)
        if (result && result.affectedRows === 0) {
            return response.status(404).json({ message: 'Usuário não encontrado para atualizar a pontuação.' });
        }
        
        // Sucesso: Pontuação substituída
        return response.status(200).json({ 
            message: 'Pontuação final salva com sucesso!', 
            finalScore: newScore 
        });
    });
});

// --- Inicialização do Servidor ---

app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
});