import { View, Image, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../components/Navigators/types/navigation';

type ImageEditScreenRouteProp = RouteProp<RootStackParamList, 'ImageEditScreen'>;

export default function ImageEditScreen() {
  const navigation = useNavigation();
  const route = useRoute<ImageEditScreenRouteProp>();
  const { imageUri } = route.params;

  return (
    <View className="flex-1 bg-zinc-300 rounded-[30px] px-4 pt-8">
      {/* Large image preview */}
      <View className="w-full h-[70%] items-center justify-center">
        <Image
          source={{ uri: imageUri }}
          className="w-64 h-[550px] rounded-[10px] border border-black"
          resizeMode="cover"
        />
      </View>
      {/* Cancel/Save buttons */}
      <View className="flex-row justify-between mt-8 px-4">
        <TouchableOpacity
          className="bg-stone-300 rounded-[30px] border border-stone-300 px-8 py-2"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-black text-xs font-normal">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-stone-300 rounded-[30px] border border-stone-300 px-8 py-2"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-black text-xs font-normal">Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
