'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttributeEditor } from '@/components/radius/AttributeEditor';
import { createUser } from '@/lib/radius-api';
import type { AttrRow } from '@/types/radius';
import { ArrowLeft, ArrowRight } from 'lucide-react';

type Step = 1 | 2;

interface StepOneValues {
  username: string;
  password: string;
}

interface FormErrors {
  username?: string;
  password?: string;
  api?: string;
}

export default function NewUserPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [values, setValues] = useState<StepOneValues>({ username: '', password: '' });
  const [replyAttrs, setReplyAttrs] = useState<AttrRow[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      router.push(`/users/${user.username}`);
    },
    onError: (err: Error) => {
      setErrors({ api: err.message || 'Erreur lors de la création' });
    },
  });

  const validateStep1 = (): boolean => {
    const e: FormErrors = {};
    if (!values.username.trim()) {
      e.username = "Le nom d'utilisateur est requis";
    } else if (/\s/.test(values.username)) {
      e.username = "Le nom d'utilisateur ne doit pas contenir d'espaces";
    }
    if (!values.password) {
      e.password = 'Le mot de passe est requis';
    } else if (values.password.length < 8) {
      e.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = () => {
    mutation.mutate({
      username: values.username,
      password: values.password,
      reply_attrs: replyAttrs,
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Ajouter un utilisateur</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={
            step === 1 ? 'font-semibold text-primary' : 'text-muted-foreground'
          }
        >
          1. Informations
        </span>
        <span className="text-muted-foreground">→</span>
        <span
          className={
            step === 2 ? 'font-semibold text-primary' : 'text-muted-foreground'
          }
        >
          2. Attributs (optionnel)
        </span>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Identifiants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                Nom d&apos;utilisateur <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                value={values.username}
                onChange={(e) => setValues((v) => ({ ...v, username: e.target.value }))}
                placeholder="ex: jean.dupont"
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Mot de passe <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={values.password}
                onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
                placeholder="Minimum 8 caractères"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" onClick={handleNext}>
                Suivant
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/users')}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Attributs de réponse (optionnel)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ces attributs seront envoyés au client lors de l&apos;authentification.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <AttributeEditor
              attrs={replyAttrs}
              onChange={setReplyAttrs}
              context="reply"
            />

            {errors.api && (
              <p className="text-sm text-destructive">{errors.api}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Création...' : "Créer l'utilisateur"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Précédent
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/users')}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
