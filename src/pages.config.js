/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Login",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminManagement from './pages/AdminManagement';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import UsageLogs from './pages/UsageLogs';
import Chemicals from './pages/Chemicals';
import Consumables from './pages/Consumables';
import Settings from './pages/Settings';
import StudentUse from './pages/StudentUse';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import About from './pages/About';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminManagement": AdminManagement,
    "Dashboard": Dashboard,
    "Reports": Reports,
    "UsageLogs": UsageLogs,
    "Chemicals": Chemicals,
    "Consumables": Consumables,
    "Settings": Settings,
    "About": About,
    "StudentUse": StudentUse,
    "Login": Login,
    "set-password": SetPassword,
}

export const pagesConfig = {
    mainPage: "Login",
    Pages: PAGES,
    Layout: __Layout,
};
