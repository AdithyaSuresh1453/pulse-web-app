import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './components/DashboardLayout';
import { VoiceAssistant } from './components/VoiceAssistant';
import { NotificationSystem } from './components/NotificationSystem';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Overview } from './pages/dashboard/Overview';
import { RegisteredObjects } from './pages/dashboard/RegisteredObjects';
import { AddObject } from './pages/dashboard/AddObject';
import { LiveCamera } from './pages/dashboard/LiveCamera';
import { AlertsHistory } from './pages/dashboard/AlertsHistory';
import { PhoneRecovery } from './pages/dashboard/PhoneRecovery';
import { Settings } from './pages/dashboard/Settings';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationSystem />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Overview />
                  </DashboardLayout>
                  <VoiceAssistant />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/objects"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <RegisteredObjects />
                  </DashboardLayout>
                  <VoiceAssistant />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/add-object"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AddObject />
                  </DashboardLayout>
                  <VoiceAssistant />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/camera"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <LiveCamera />
                  </DashboardLayout>
                  <VoiceAssistant />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/alerts"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AlertsHistory />
                  </DashboardLayout>
                  <VoiceAssistant />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/phone-recovery"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PhoneRecovery />
                  </DashboardLayout>
                  <VoiceAssistant />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Settings />
                  </DashboardLayout>
                  <VoiceAssistant />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
