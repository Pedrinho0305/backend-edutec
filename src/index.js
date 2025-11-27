// server.js (Use este código no seu terminal com 'node server.js')

const express = require('express');
const app = express();
const PORT = 5500;
const cors = require('cors'); 
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');

// Array de usuários para simular o Banco de Dados (Usuários persistem enquanto o servidor estiver rodando)
const users = []; 

// Middlewares
app.post('/cadastro', async (req, res) => {
    const { email, senha } = req.body;
    
    try {
        // 1. Verifica se o e-mail já existe
        const [existingUser] = await connection.execute(
            `SELECT email FROM users WHERE email = ?`, 
            [email]
        );
        
        if (existingUser.length > 0) {
            return res.status(409).json({ 
                message: "Este e-mail já está cadastrado. Tente fazer login." 
            });
        }

        // 2. Insere o novo usuário na tabela. O score receberá o valor DEFAULT (0).
        // NOTA: Em produção, 'senha' deve ser hasheada (ex: bcrypt).
        await connection.execute(
            `INSERT INTO users (email, password_hash, score) VALUES (?, ?, 0)`,
            [email, senha]
        );
        
        console.log(`[CADASTRO] Novo usuário cadastrado no MySQL: ${email}.`);
        
        // Retorna 201 Created
        res.status(201).json({ 
            message: "Usuário cadastrado com sucesso!" 
        });

    } catch (error) {
        console.error("Erro no cadastro (MySQL):", error);
        res.status(500).json({ message: "Erro interno do servidor no cadastro." });
    }
});


// ===============================================
// Rota de LOGIN (POST /login) - AGORA COM MYSQL
// ===============================================
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    
    try {
        // 1. Procura o usuário e verifica a senha (usando senha pura para simplificar)
        const [rows] = await connection.execute(
            `SELECT email, password_hash FROM users WHERE email = ? AND password_hash = ?`,
            [email, senha]
        );
        
        if (rows.length > 0) {
            const foundUser = rows[0];
            
            console.log(`[LOGIN] Sucesso para: ${email}`);
            
            // Retorna 200 OK
            return res.status(200).json({ 
                message: "Login bem-sucedido.", 
                user: { email: foundUser.email }
            });
        } else {
            console.log(`[LOGIN] Falha para: ${email}`);
            // Retorna 401 Unauthorized
            return res.status(401).json({ 
                message: "E-mail ou senha incorretos." 
            });
        }

    } catch (error) {
        console.error("Erro no login (MySQL):", error);
        res.status(500).json({ message: "Erro interno do servidor no login." });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});


const MAX_SCORE = 1000;

app.use(cors());
app.use(bodyParser.json());

// --- Configuração do Banco de Dados ---
const dbConfig = {
    host: 'benserverplex.ddns.net',       // ou o endereço do seu servidor MySQL
    user: 'alunos',     // SEU USUÁRIO MySQL
    password: 'senhaAlunos',   // SUA SENHA MySQL
    database: 'pontuacao_email'    // O NOME DO SEU BANCO DE DADOS
};

let connection;

function startServer() {
    
    // ===============================================
    // Rota para ATUALIZAR PONTUAÇÃO (POST /update-score)
    // ESTA ROTA SÓ É DEFINIDA SE A CONEXÃO FOI BEM SUCEDIDA
    // ===============================================
    app.post('/update-score', async (req, res) => {
        const { email, newScore } = req.body; 

        // Adicione toda a sua lógica de atualização do MySQL aqui
        
        const scoreValue = parseInt(newScore); 
        if (isNaN(scoreValue)) {
            return res.status(400).json({ message: "Pontuação inválida." });
        }
        
        const finalScore = Math.min(scoreValue, MAX_SCORE);
        
        try {
            // Tenta atualizar a pontuação APENAS se a nova for maior (GREATEST)
            const [result] = await connection.execute(
                `UPDATE users SET score = GREATEST(score, ?) WHERE email = ?`,
                [finalScore, email]
            );

            // Se o GREATEST não atualizar (0 linhas afetadas), significa que não foi recorde.
            if (result.affectedRows === 0) {
                 // Busca a pontuação atual para devolver
                const [check] = await connection.execute(`SELECT score FROM users WHERE email = ?`, [email]);
                
                if (check.length === 0) {
                     return res.status(404).json({ message: "Usuário não encontrado." });
                }
                
                return res.status(200).json({ 
                    message: "Pontuação mantida. Não foi um novo recorde.",
                    newRecord: false,
                    score: check[0].score
                });
            } else {
                // Se afetou 1 linha, foi um novo recorde.
                return res.status(200).json({ 
                    message: "Pontuação atualizada com sucesso. Novo Recorde!",
                    newRecord: true,
                    score: finalScore 
                });
            }
        } catch (error) {
            console.error("Erro ao atualizar pontuação no MySQL:", error);
            // Retorna 500 em caso de erro no banco
            return res.status(500).json({ message: "Erro interno do servidor ao salvar pontuação." });
        }
    });


    // ===============================================
    // Rota de RANKING (GET /ranking)
    // ESTA ROTA SÓ É DEFINIDA SE A CONEXÃO FOI BEM SUCEDIDA
    // ===============================================
    app.get('/ranking', async (req, res) => {
        try {
            const [rows] = await connection.execute(
                `SELECT email, score FROM users 
                 WHERE score IS NOT NULL AND score > 0 
                 ORDER BY score DESC 
                 LIMIT 100`
            );
            
            console.log(`[RANKING] Dados de ${rows.length} usuários solicitados.`);
            res.status(200).json(rows);

        } catch (error) {
            console.error("Erro ao buscar ranking no MySQL:", error);
            res.status(500).json({ message: "Erro interno do servidor ao buscar ranking." });
        }
    });


    // Inicia o listener do Express
    app.listen(PORT, () => {
        console.log(`Servidor de API rodando em http://localhost:${PORT}`);
    });
}


// ===============================================
// INICIALIZAÇÃO FINAL: CHAMA O BANCO, DEPOIS CHAMA AS ROTAS
// ===============================================
handleDatabaseConnection()
    .then(startServer) // Chama startServer() SOMENTE após o MySQL conectar
    .catch((err) => {
        console.error("Não foi possível iniciar o servidor devido a erros de conexão com o banco de dados.");
        process.exit(1);
    });


handleDatabaseConnection()

async function handleDatabaseConnection() {
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log("Conexão com MySQL estabelecida com sucesso!");

        // Garante que a tabela 'users' existe com a coluna 'score'
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                email VARCHAR(255) PRIMARY KEY,
                password_hash VARCHAR(255) NOT NULL,
                score INT DEFAULT 0
            );
        `);
        console.log("Tabela 'users' verificada/criada.");

    } catch (err) {
        console.error("Erro ao conectar ou inicializar o MySQL:", err);
        // Termina o processo se a conexão falhar
        process.exit(1); 
    }
}