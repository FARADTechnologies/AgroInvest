package dev.agroportal.ektismock.farmer;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Optional;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** The mock farmer registry, loaded from {@code farmers.json} (fictional records). */
@Component
public class FarmerRegistry {

    private final List<Farmer> farmers;

    public FarmerRegistry(ObjectMapper mapper) throws IOException {
        try (InputStream in = new ClassPathResource("farmers.json").getInputStream()) {
            this.farmers = List.copyOf(mapper.readValue(in, new TypeReference<List<Farmer>>() {}));
        }
    }

    public Optional<Farmer> byFin(String fin) {
        return farmers.stream().filter(f -> fin.equals(f.fin())).findFirst();
    }

    public Optional<Farmer> byVoen(String voen) {
        return farmers.stream().filter(f -> voen.equals(f.voen())).findFirst();
    }
}
