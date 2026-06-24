// Função para carregar componentes HTML
async function loadComponent(elementId, componentPath) {
    try {
        const response = await fetch(componentPath);
        const html = await response.text();
        const placeholder = document.getElementById(elementId);
        placeholder.innerHTML = html;

        // Se for o header, mover a navbar para fora do placeholder
        // (assim o "sticky" funciona em toda a página, não apenas dentro do header)
        if (componentPath.includes('header.html')) {
            const nav = placeholder.querySelector('#mainNav');
            if (nav && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(nav, placeholder.nextSibling);
            }
            initHeaderScripts();
        }
    } catch (error) {
        console.error('Erro ao carregar componente:', error);
    }
}

// Inicializar funcionalidades do header
function initHeaderScripts() {
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Encolher a navbar ao fazer scroll (sticky shrink)
    const mainNav = document.getElementById('mainNav');
    if (mainNav) {
        const aplicarShrink = () => {
            if (window.scrollY > 80) {
                mainNav.classList.add('nav-shrink');
            } else {
                mainNav.classList.remove('nav-shrink');
            }
        };
        aplicarShrink();
        window.addEventListener('scroll', aplicarShrink, { passive: true });
    }

    // Auth dropdown
    const authButton = document.getElementById('authButton');
    const authDropdown = document.getElementById('authDropdown');

    if (authButton && authDropdown) {
        authButton.addEventListener('click', (e) => {
            e.stopPropagation();
            authDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            authDropdown.classList.add('hidden');
        });
    }

    // Verificar se usuário está logado
    const token = localStorage.getItem('token');
    if (token && authButton && authDropdown) {
        const associado = JSON.parse(localStorage.getItem('associado') || '{}');
        authButton.innerHTML = '<i class="fas fa-user-circle mr-2"></i>' + (associado.nome || 'Minha Conta');
        
        if (associado.role === 'admin') {
            authDropdown.innerHTML = `
                <a href="/frontend/admin/index.html" class="block px-4 py-2 text-gray-800 hover:bg-indigo-50">Painel Admin</a>
                <a href="/frontend/area-cliente/dashboard.html" class="block px-4 py-2 text-gray-800 hover:bg-indigo-50">Dashboard</a>
                <a href="/frontend/index.html" onclick="logout()" class="block px-4 py-2 text-red-600 hover:bg-red-50">Sair</a>
            `;
        } else {
            authDropdown.innerHTML = `
                <a href="/frontend/area-cliente/dashboard.html" class="block px-4 py-2 text-gray-800 hover:bg-indigo-50">Dashboard</a>
                <a href="/frontend/index.html" onclick="logout()" class="block px-4 py-2 text-red-600 hover:bg-red-50">Sair</a>
            `;
        }
    }
}

// Logout function (global)
window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('associado');
    window.location.href = '/';
};

// Carregar componentes quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('header-placeholder', '/frontend/components/header.html');
    loadComponent('footer-placeholder', '/frontend/components/footer.html');
});