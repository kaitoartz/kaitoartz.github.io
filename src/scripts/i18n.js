const translations = {
    es: {
        "header.subtitle": "VR DEVELOPER // TECH ARTIST // EGRESADO EN ARTES Y TECNOLOGÍAS DE LA COMUNICACIÓN",
        "stats.projects": "PROYECTOS",
        "stats.colabs": "COLAB",
        "stats.hours": "HORAS_XR",
        "info.label": "INFO_SISTEMA",
        "info.text": "Desarrollador y artista técnico especializado en realidad virtual (VR) y experiencias inmersivas interactivas, con más de 3 años de experiencia profesional en el uso de Unity para proyectos de carácter educativo y de investigación.",
        "link.portfolio": "PORTAFOLIO",
        "link.code": "CÓDIGO_FUENTE",
        "link.vr": "PROYECTOS_VR",
        "projects.label": "PROYECTOS_ACTIVOS",
        "filters.all": "TODOS",
        "skills.label": "MATRIZ_HABILIDADES",
        "timeline.label": "REGISTRO_EXP",
        "contact.label": "FORM_CONTACTO",
        "contact.name": "ID_NOMBRE:",
        "placeholder.name": "Juan_Perez",
        "contact.email": "DIRECCION_EMAIL:",
        "placeholder.email": "usuario@dominio.ext",
        "contact.message": "CARGA_MENSAJE:",
        "placeholder.message": "Ingresa transmisión...",
        "contact.submit": "TRANSMITIR_DATOS",
        "footer.sync": "SINC:"
    },
    en: {
        "header.subtitle": "VR DEVELOPER // TECH ARTIST // GRADUATE IN COMMUNICATION ARTS AND TECHNOLOGIES",
        "stats.projects": "PROJECTS",
        "stats.colabs": "COLABS",
        "stats.hours": "XR_HOURS",
        "info.label": "SYSTEM_INFO",
        "info.text": "Developer and technical artist specialized in virtual reality (VR) and interactive immersive experiences, with over 3 years of professional experience using Unity for educational and research projects.",
        "link.portfolio": "PORTFOLIO",
        "link.code": "SOURCE_CODE",
        "link.vr": "VR_PROJECTS",
        "projects.label": "ACTIVE_PROJECTS",
        "filters.all": "ALL",
        "skills.label": "SKILLS_MATRIX",
        "timeline.label": "EXPERIENCE_LOG",
        "contact.label": "CONTACT_FORM",
        "contact.name": "NAME_IDENTIFIER:",
        "placeholder.name": "John_Doe",
        "contact.email": "EMAIL_ADDRESS:",
        "placeholder.email": "user@domain.ext",
        "contact.message": "MESSAGE_PAYLOAD:",
        "placeholder.message": "Enter transmission...",
        "contact.submit": "TRANSMIT_DATA",
        "footer.sync": "SYNC:"
    }
};

export class I18nManager {
    constructor() {
        this.currentLang = localStorage.getItem('systemLanguage') || 'es';
        this.elements = document.querySelectorAll('[data-i18n]');
        
        // Setup toggle button
        this.toggleBtn = document.querySelector('.lang-toggle-btn');
        this.langText = document.querySelector('.lang-text');
        
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleLanguage());
        }

        this.updateInterface();
    }

    toggleLanguage() {
        this.currentLang = this.currentLang === 'es' ? 'en' : 'es';
        localStorage.setItem('systemLanguage', this.currentLang);
        this.updateInterface();
    }

    updateInterface() {
        // Update toggle text
        if (this.langText) {
            this.langText.textContent = this.currentLang.toUpperCase();
        }

        // Update all elements with data-i18n attribute
        this.elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if(!translations[this.currentLang] || !translations[this.currentLang][key]) return;

            const translation = translations[this.currentLang][key];

            // If it's an input/textarea placeholder, update placeholder
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.setAttribute('placeholder', translation);
            } else {
                el.innerHTML = translation; // Update span/div/p contents
            }
        });

        // Dispatch an event so other scripts (like timeline or projects loader) can re-render if needed
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: this.currentLang } }));
    }
    
    get(key) {
        return translations[this.currentLang][key] || key;
    }
}
