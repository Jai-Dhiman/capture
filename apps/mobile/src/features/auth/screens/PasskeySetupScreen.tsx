import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import { PasskeySetup } from '../components/PasskeySetup';
import { useAuthStore } from '../stores/authStore';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PasskeySetup'>;
};

export default function PasskeySetupScreen({ navigation }: Props) {
  const authStage = useAuthStore((state) => state.stage);

  const isMandatory = authStage === 'securitySetupRequired';

  const handleComplete = async () => {
    if (authStage === 'securitySetupRequired') {
      const waitForAuthUpdate = () => {
        return new Promise<void>((resolve) => {
          const checkStage = () => {
            const currentStage = useAuthStore.getState().stage;
            if (currentStage !== 'securitySetupRequired') {
              resolve();
            } else {
              setTimeout(checkStage, 50);
            }
          };
          checkStage();
        });
      };

      await waitForAuthUpdate();

      const finalStage = useAuthStore.getState().stage;
      if (finalStage === 'profileRequired') {
        navigation.replace('CreateProfile');
      } else {
        navigation.replace('MainApp' as any); // TODO: Update with correct main app navigation
      }
    } else {
      navigation.navigate('CreateProfile');
    }
  };

  const handleSkip = () => {
    if (isMandatory) {
      // Navigate to alternative MFA setup screen (placeholder for now)
      console.log('TODO: Navigate to alternative MFA setup');
      // For now, just mark as completed - in real implementation we'd set up other MFA
      navigation.replace('MainApp' as any);
    } else {
      navigation.navigate('CreateProfile');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header showBackButton={!isMandatory} onBackPress={() => navigation.goBack()} />
      <PasskeySetup
        onComplete={handleComplete}
        onSkip={handleSkip}
        isMandatory={isMandatory}
      />
    </View>
  );
}
