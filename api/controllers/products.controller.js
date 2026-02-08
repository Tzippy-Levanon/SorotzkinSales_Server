import getSupabase from "../../config/db.js";

const supabase = getSupabase();

export const getAllProducts = async (req, res) => {
    const { data, error } = await supabase.from('Products').select('*');

    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(data);
};
