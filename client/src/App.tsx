import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Consulta from "./pages/Consulta";
import Historico from "./pages/Historico";
import Detalhes from "./pages/Detalhes";
import Planos from "./pages/Planos";
import Assinatura from "./pages/Assinatura";
import Admin from "./pages/Admin";
import AdminPlanos from "./pages/AdminPlanos";
import MinhaConta from "./pages/MinhaConta";
import Carteira from "./pages/Carteira";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RecuperarSenha from "./pages/RecuperarSenha";
import RedefinirSenha from "./pages/RedefinirSenha";

function Router() {
  return (
    <Switch>
      {/* Rotas públicas de autenticação - fora do DashboardLayout */}
      <Route path="/login" component={Login} />
      <Route path="/cadastro" component={Cadastro} />
      <Route path="/recuperar-senha" component={RecuperarSenha} />
      <Route path="/redefinir-senha" component={RedefinirSenha} />

      {/* Rotas protegidas - dentro do DashboardLayout */}
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/consulta" component={Consulta} />
            <Route path="/historico" component={Historico} />
            <Route path="/detalhes/:id" component={Detalhes} />
            <Route path="/planos" component={Planos} />
            <Route path="/carteira" component={Carteira} />
            <Route path="/assinatura" component={Assinatura} />
            <Route path="/admin" component={Admin} />
            <Route path="/admin/planos" component={AdminPlanos} />
            <Route path="/minha-conta" component={MinhaConta} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

