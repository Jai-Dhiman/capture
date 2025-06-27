import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, View } from 'react-native';
import { PasskeySetup } from '../components/PasskeySetup';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/authStore';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PasskeySetup'>;
};

export default function PasskeySetupScreen({ navigation }: Props) {
  const authStage = useAuthStore((state) => state.stage);
  const { logout } = useAuth();

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
      // Navigate to alternative MFA setup screen
      navigation.navigate('MFACreation');
    } else {
      navigation.navigate('CreateProfile');
    }
  };

  const handleBackPress = () => {
    Alert.alert(
      'Are you sure?',
      'You will be logged out and returned to the login screen.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          onPress: () => {
            logout.mutate(undefined, {
              onSuccess: () => {
                navigation.navigate('Login');
              },
            });
          },
          style: 'destructive',
        },
      ],
      { cancelable: false },
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Header showBackButton={!isMandatory} onBackPress={handleBackPress} />
      <PasskeySetup
        onComplete={handleComplete}
        onSkip={handleSkip}
        isMandatory={isMandatory}
      />
    </View>
  );
}
