// server.js (Use este código no seu terminal com 'node server.js')

const express = require('express');
const app = express();
const PORT = 5500;
const cors = require('cors'); 

// Array de usuários para simular o Banco de Dados (Usuários persistem enquanto o servidor estiver rodando)
const users = []; 

// Middlewares
app.use(express.json()); 
app.use(cors()); 


// ===============================================
// Rota de CADASTRO (POST /cadastro)
// ===============================================
app.post('/cadastro', (req, res) => {
    const { email, senha } = req.body;
    
    // Verifica se o email já existe
    const existingUser = users.find(user => user.email === email);
    
    if (existingUser) {
        return res.status(409).json({ 
            message: "Este e-mail já está cadastrado. Tente fazer login." 
        });
    }

    // Adiciona o novo usuário
    const newUser = { email, senha };
    users.push(newUser);
    
    console.log(`[CADASTRO] Novo usuário cadastrado: ${email}. Total: ${users.length}`);
    
    // Retorna 201 Created
    res.status(201).json({ 
        message: "Usuário cadastrado com sucesso!" 
    });
});


// ===============================================
// Rota de LOGIN (POST /login)
// ===============================================
app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    
    // Procura o usuário no "banco de dados"
    const foundUser = users.find(user => 
        user.email === email && user.senha === senha
    );

    if (foundUser) {
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
});


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});