import { useState } from "react";
import { View, TextInput, Button, Alert } from "react-native";
import { supabase } from "../lib/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Sign up with email/password
  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Success", "Check your email for confirmation!");
    setLoading(false);
  };

  // Sign in with email/password
  const handleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) Alert.alert("Error", error.message);
    setLoading(false);
  };

  // Sign out
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Error", error.message);
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title="Sign Up"
        onPress={handleSignUp}
        disabled={loading}
      />
      <Button
        title="Sign In"
        onPress={handleSignIn}
        disabled={loading}
      />
      <Button
        title="Sign Out"
        onPress={handleSignOut}
        disabled={loading}
      />
    </View>
  );
}