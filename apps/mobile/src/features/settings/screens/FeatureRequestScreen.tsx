import type { SettingsStackParamList } from '@/navigation/types';
import { useAlert } from '@/shared/lib/AlertContext';
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import React from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { CustomBackIconSvg } from '@assets/icons/svgStrings';
import { svgToDataUri } from '@/shared/utils/svgUtils';
import { Image } from 'expo-image';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'FeatureRequest'>;

const CREATE_TICKET_MUTATION = `
  mutation CreateTicket($input: CreateTicketInput!) {
    createTicket(input: $input) {
      id
      subject
      status
    }
  }
`;

export default function FeatureRequestScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { showAlert } = useAlert();

  const createTicket = useMutation({
    mutationFn: async (data: { subject: string; description: string }) => {
      const result = await graphqlFetch<{
        createTicket: { id: string; subject: string; status: string };
      }>({
        query: CREATE_TICKET_MUTATION,
        variables: {
          input: {
            subject: data.subject,
            description: data.description,
            type: 'FEATURE_REQUEST',
          },
        },
      });
      return result.createTicket;
    },
    onSuccess: () => {
      showAlert('Feature request submitted. Thank you for your feedback!', { type: 'success' });
      navigation.goBack();
    },
    onError: (error: Error) => {
      showAlert(error.message || 'Failed to submit feature request', { type: 'error' });
    },
  });

  const form = useForm({
    defaultValues: {
      subject: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      if (!value.subject.trim()) {
        showAlert('Please enter a subject', { type: 'warning' });
        return;
      }
      if (!value.description.trim()) {
        showAlert('Please describe your feature request', { type: 'warning' });
        return;
      }
      createTicket.mutate(value);
    },
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-[#DCDCDE]">
        <StatusBar barStyle="dark-content" />

        <View className="w-full pt-14 px-4 pb-4 flex-row items-center">
          <TouchableOpacity
            className="absolute left-4 top-14 w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
            onPress={() => navigation.goBack()}
          >
            <Image
              source={{ uri: svgToDataUri(CustomBackIconSvg) }}
              style={{ width: 30, height: 30 }}
            />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-semibold">Feature Request</Text>
        </View>

        <ScrollView className="flex-1 px-4">
          <Text className="text-sm text-gray-600 mb-6">
            Have an idea that would make Capture better? We'd love to hear it!
          </Text>

          <form.Field name="subject">
            {(field) => (
              <View className="mb-4">
                <Text className="text-xs font-semibold mb-2">Feature Name</Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-sm border border-gray-200"
                  placeholder="What feature would you like to see?"
                  placeholderTextColor="#9CA3AF"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  maxLength={100}
                />
              </View>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <View className="mb-6">
                <Text className="text-xs font-semibold mb-2">Description</Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-sm border border-gray-200 min-h-[150px]"
                  placeholder="Tell us more about your idea and how it would help you..."
                  placeholderTextColor="#9CA3AF"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />
                <Text className="text-[10px] text-gray-400 mt-1 text-right">
                  {field.state.value.length}/2000
                </Text>
              </View>
            )}
          </form.Field>

          <TouchableOpacity
            className="bg-[#E4CAC7] py-4 rounded-full mb-8"
            onPress={() => form.handleSubmit()}
            disabled={createTicket.isPending}
          >
            {createTicket.isPending ? (
              <ActivityIndicator color="#1F2937" />
            ) : (
              <Text className="text-center text-gray-800 font-semibold text-base">
                Submit Feature Request
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}
