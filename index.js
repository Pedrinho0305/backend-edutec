// index.js (CommonJS - Mais robusto para Vercel Serverless)

const express = require('express');
const cors = require('cors');
// Usamos o módulo 'promise' do mysql2 para o async/await
const mysql = require('mysql2/promise'); 
// Pacote para ler o arquivo .env localmente
const dotenv = require('dotenv'); 

// Carrega as variáveis de ambiente do .env para testes locais
// (A Vercel e o seu script 'nodemon' já cuidam disso em produção)
dotenv.config(); 

const app = express();

// Configuração do Banco de Dados
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

// Middlewares
app.use(cors());
app.use(express.json());

// Função para criar e retornar uma nova conexão (chamada em cada rota)
async function getConnection() {
    return await mysql.createConnection(dbConfig); 
}

// =======================================================
// Rota GET /
// =======================================================
app.get("/", async (request, response) => {
    let connection;
    try {
        connection = await getConnection(); 
        const selectCommand = "SELECT name, email FROM pedrohenrique_02mb";
        const [users] = await connection.execute(selectCommand); 
        response.json(users);
        
    } catch (error) {
        console.error("Erro na rota GET /:", error);
        response.status(500).json({ message: "Erro interno do servidor." });
    } finally {
        // ESSENCIAL: Garante que a conexão seja fechada
        if (connection) {
            await connection.end(); 
        }
    }
});

// =======================================================
// Rota POST /login
// =======================================================
app.post("/login", async (request, response) => {
    let connection;
    try {
        connection = await getConnection();
        const { email, password } = request.body.user;
        const selectCommand = "SELECT * FROM pedrohenrique_02mb WHERE email = ?";
        const [userRows] = await connection.execute(selectCommand, [email]); 
        
        if (userRows.length === 0 || userRows[0].password !== password) {
            return response.status(401).json({ message: "Usuário ou senha incorretos!" });
        }

        const user = userRows[0];
        response.json({ id: user.id, name: user.name });

    } catch (error) {
        console.error("Erro na rota POST /login:", error);
        response.status(500).json({ message: "Erro interno do servidor!" });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// =======================================================
// Rota POST /cadastrar
// =======================================================
app.post("/cadastrar", async (request, response) => {
    let connection;
    try {
        connection = await getConnection();
        const { user } = request.body;
        
        // 1. Verificar se o usuário já existe
        const checkCommand = "SELECT email FROM pedrohenrique_02mb WHERE email = ?";
        const [existing] = await connection.execute(checkCommand, [user.email]);
        if (existing.length > 0) {
            return response.status(409).json({ message: "Este e-mail já está cadastrado." });
        }
        
        // 2. Insere novo usuário
        const insertCommand = `
            INSERT INTO pedrohenrique_02mb(name, email, password)
            VALUES (?, ?, ?)
        `;
        await connection.execute(insertCommand, [user.name, user.email, user.password]);
        
        response.status(201).json({ message: "Usuário cadastrado com sucesso!" });
        
    } catch (error) {
        console.error("Erro na rota POST /cadastrar:", error);
        response.status(500).json({ message: "Erro interno do servidor." });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// =======================================================
// Bloco Híbrido (Para testes locais)
// =======================================================

const port = 3333; 

// Só executa o app.listen() se o ambiente NÃO for de produção (Vercel)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`\n[LOCAL MODE] Servidor rodando em http://localhost:${port}`);
    });
}


// Exporta o app. Este é o ponto de entrada Serverless para a Vercel.
module.exports = app;
