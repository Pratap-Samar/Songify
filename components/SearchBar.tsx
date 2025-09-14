import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';


import {
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SearchBar() {
    const [form, setForm] = useState<string>("");

    const handleChange = (e: string) => {
        setForm(e)
    }

    const findMusic = async (song: string) => {
        try {
            const res = await fetch(`http://localhost:8080/${song}`)
            const songData = await res.json()
            console.log(songData)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        if (form != "") {
            console.log("Submitting... ", form)
            findMusic(form)
        }
    }, [form])

    const handleClearSearch = () => {
        setForm('');
    };

    return (
        <View style={style.formContainer}>
            <Feather
                name="search"
                size={20}
                color="#8e8e93"
                style={style.searchIcon}
            />
            <TextInput
                value={form}
                onChangeText={handleChange}
                returnKeyType="search"
                style={style.input}
                placeholder='Search for songs'
                placeholderTextColor="#8e8e93"
            />
            {form.length > 0 && (
                <TouchableOpacity onPress={handleClearSearch} style={style.xIcon}>
                    <Feather name="x" size={20} color="#8e8e93" />
                </TouchableOpacity>
            )}
        </View>
    );
}


const style = StyleSheet.create({
    formContainer: {
        margin: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f1f3',
        borderRadius: 15,
        height: 50,
        paddingHorizontal: 16,
        // iOS Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        // Android Shadow
        elevation: 3,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        marginLeft: 10,
    },
    searchIcon: {
    },
    xIcon: {
    },
})