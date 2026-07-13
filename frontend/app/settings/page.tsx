'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RotateCcw, Moon, Sun, Monitor, User, Lock, UserPlus, Shield, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { settingsApi, authApi } from '@/lib/api';
import { useStore } from '@/lib/store';
import { isPasswordValid } from '@/lib/password';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { useLocale } from '@/components/providers/locale-provider';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const { user, token, setOutputFormat, setQuality } = useStore();
  const [mounted, setMounted] = useState(false);
  
  // Settings state
  const [maxUploadSize, setMaxUploadSize] = useState(100);
  const [defaultQuality, setDefaultQuality] = useState(85);
  const [defaultFormat, setDefaultFormat] = useState('webp');
  const [maxParallelJobs, setMaxParallelJobs] = useState(5);
  const [deleteOriginals, setDeleteOriginals] = useState(false);
  const [autoDownload, setAutoDownload] = useState(true);
  const [historyRetention, setHistoryRetention] = useState(24);
  const [requireLogin, setRequireLogin] = useState(false);
  
  // Account dialogs
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  
  // Create account state
  const [newEmail, setNewEmail] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountConfirm, setNewAccountConfirm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await settingsApi.get();
      if (settings) {
        setDefaultQuality(settings.default_quality || 85);
        setDefaultFormat(settings.default_format || 'webp');
        setMaxParallelJobs(settings.max_parallel_jobs || 5);
        setDeleteOriginals(settings.delete_originals || false);
        setAutoDownload(settings.auto_download ?? true);
        setRequireLogin(settings.require_login ?? false);
        
        // Sync with global store
        setOutputFormat(settings.default_format || 'webp');
        setQuality(settings.default_quality || 85);
      }
    } catch (error) {
      // Settings might not be available if not logged in
      console.log('Could not load settings');
    }
  }, [setOutputFormat, setQuality]);

  useEffect(() => {
    setMounted(true);
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    try {
      await settingsApi.update({
        default_quality: defaultQuality,
        default_format: defaultFormat,
        max_parallel_jobs: maxParallelJobs,
        delete_originals: deleteOriginals,
        auto_download: autoDownload,
      });
      
      // Sync with global store immediately
      setOutputFormat(defaultFormat);
      setQuality(defaultQuality);
      
      toast.success(t('Settings saved!'));
    } catch (error) {
      toast.error(t('Failed to save settings'));
    }
  };

  const resetSettings = async () => {
    try {
      await settingsApi.reset();
      await loadSettings();
      toast.success(t('Settings reset to defaults'));
    } catch (error) {
      toast.error(t('Failed to reset settings'));
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (!isPasswordValid(newPassword)) {
      toast.error('Password must be 8+ chars with upper, lower, digit and special character');
      return;
    }
    
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully!');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    }
  };

  const handleCreateAccount = async () => {
    if (!newEmail || !newAccountPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (newAccountPassword !== newAccountConfirm) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (!isPasswordValid(newAccountPassword)) {
      toast.error('Password must be 8+ chars with upper, lower, digit and special character');
      return;
    }
    
    try {
      await authApi.createUser(newEmail, newAccountPassword, isAdmin);
      toast.success('Account created successfully!');
      setShowCreateAccount(false);
      setNewEmail('');
      setNewAccountPassword('');
      setNewAccountConfirm('');
      setIsAdmin(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">{t('Settings')}</h1>
          <div className="ml-auto"><LocaleSwitcher /></div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Account Management */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('Account')}
            </h2>
            <div className="p-4 rounded-xl border border-border space-y-4">
              {token && user ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t('Logged in as')}</Label>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowChangePassword(true)}>
                      <Lock className="h-4 w-4 mr-2" />
                      {t('Change Password')}
                    </Button>
                  </div>
                  
                  {user.is_admin && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <Label>{t('Create New Account')}</Label>
                        <p className="text-sm text-muted-foreground">{t('Add a new user (admin only)')}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setShowCreateAccount(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t('Create Account')}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">{t('Log in to manage your account')}</p>
                  <Link href="/login">
                    <Button>
                      <User className="h-4 w-4 mr-2" />
                      {t('Log In')}
                    </Button>
                  </Link>
                  <Link href="/register" className="ml-2">
                    <Button variant="outline">
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('Register')}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Security */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('Security')}
            </h2>
            <div className="p-4 rounded-xl border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('Require Login')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('Users must log in to use the application')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${requireLogin ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {requireLogin ? t('Enabled') : t('Disabled')}
                  </span>
                </div>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                ℹ️ This setting is configured via REQUIRE_LOGIN in .env file and requires container restart to change
              </p>
            </div>
          </section>

          {/* Appearance */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('Appearance')}</h2>
            <div className="p-4 rounded-xl border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('Theme')}</Label>
                  <p className="text-sm text-muted-foreground">{t('Choose your preferred theme')}</p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        {t('Light')}
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        {t('Dark')}
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        {t('System')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Processing Defaults */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('Processing Defaults')}</h2>
            <div className="p-4 rounded-xl border border-border space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>{t('Default Quality')}</Label>
                  <span className="text-sm text-muted-foreground">{defaultQuality}%</span>
                </div>
                <Slider
                  value={[defaultQuality]}
                  onValueChange={([v]) => setDefaultQuality(v)}
                  min={1}
                  max={100}
                  step={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG/WebP compression quality for processed images
                </p>
              </div>

              <div>
                <Label>{t('Default Output Format')}</Label>
                <Select value={defaultFormat} onValueChange={setDefaultFormat}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webp">WebP (recommended)</SelectItem>
                    <SelectItem value="png">PNG (lossless)</SelectItem>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                    <SelectItem value="avif">AVIF (best compression)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>{t('Max Parallel Jobs')}</Label>
                  <span className="text-sm text-muted-foreground">{maxParallelJobs}</span>
                </div>
                <Slider
                  value={[maxParallelJobs]}
                  onValueChange={([v]) => setMaxParallelJobs(v)}
                  min={1}
                  max={20}
                  step={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of images to process simultaneously
                </p>
              </div>
            </div>
          </section>

          {/* Upload Settings */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('Upload Settings')}</h2>
            <div className="p-4 rounded-xl border border-border space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>{t('Max Upload Size')}</Label>
                  <span className="text-sm text-muted-foreground">{maxUploadSize} MB</span>
                </div>
                <Slider
                  value={[maxUploadSize]}
                  onValueChange={([v]) => setMaxUploadSize(v)}
                  min={10}
                  max={500}
                  step={10}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>{t('History Retention')}</Label>
                  <span className="text-sm text-muted-foreground">{historyRetention} hours</span>
                </div>
                <Slider
                  value={[historyRetention]}
                  onValueChange={([v]) => setHistoryRetention(v)}
                  min={1}
                  max={168}
                  step={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How long to keep processed files before automatic deletion
                </p>
              </div>
            </div>
          </section>

          {/* Behavior */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('Behavior')}</h2>
            <div className="p-4 rounded-xl border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('Auto-download results')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('Automatically download processed files')}
                  </p>
                </div>
                <Switch
                  checked={autoDownload}
                  onCheckedChange={setAutoDownload}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('Delete originals after processing')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('Remove source files after successful processing')}
                  </p>
                </div>
                <Switch
                  checked={deleteOriginals}
                  onCheckedChange={setDeleteOriginals}
                />
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-4">
            <Button onClick={saveSettings} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {t('Save Settings')}
            </Button>
            <Button variant="outline" onClick={resetSettings}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('Reset to Defaults')}
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8+ chars, upper, lower, digit, special"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showPasswords} onCheckedChange={setShowPasswords} />
              <Label className="text-sm">Show passwords</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePassword(false)}>Cancel</Button>
            <Button onClick={handleChangePassword}>Change Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={showCreateAccount} onOpenChange={setShowCreateAccount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newAccountPassword}
                onChange={(e) => setNewAccountPassword(e.target.value)}
                placeholder="8+ chars, upper, lower, digit, special"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={newAccountConfirm}
                onChange={(e) => setNewAccountConfirm(e.target.value)}
                placeholder="Confirm password"
              />
              {newAccountConfirm.length > 0 && newAccountPassword !== newAccountConfirm && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
              <Label className="text-sm">Admin privileges</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAccount(false)}>Cancel</Button>
            <Button onClick={handleCreateAccount}>Create Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
